// Gera N questões ENAMED-style baseadas num caso clínico já montado.
// Input: { case_id, n: 3-10 }
// Cada questão é vinheta + 5 alternativas + gabarito + comentário.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { claudeJson, toClaudeError } from "../_shared/claude.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SYSTEM = `Você é examinador de prova ENAMED/REVALIDA. Vai gerar questões de múltipla escolha baseadas num caso clínico fornecido.

REGRAS:
- 5 alternativas (A, B, C, D, E)
- 1 correta + 4 distratores PLAUSÍVEIS (não óbvios)
- Cada alternativa: justificativa curta explicando por que é certa/errada
- Comentário geral conectando ao raciocínio clínico
- Padrão INEP: vinheta + comando claro + alternativas curtas
- Variar o COMANDO: diagnóstico, conduta, próximo exame, complicação esperada, mecanismo
- Nível de dificuldade: misturar (fácil → difícil)
- Use o caso como BASE mas pode adicionar detalhes contextuais (lab, imagem) se ajudar a questão`;

const responseSchema = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      minItems: 1,
      maxItems: 10,
      items: {
        type: "object",
        properties: {
          enunciado: { type: "string" },
          alternativas: {
            type: "array",
            minItems: 5,
            maxItems: 5,
            items: {
              type: "object",
              properties: {
                letra: { type: "string", enum: ["A","B","C","D","E"] },
                texto: { type: "string" },
                correta: { type: "boolean" },
                justificativa: { type: "string" },
              },
              required: ["letra","texto","correta","justificativa"],
            },
          },
          letra_correta: { type: "string", enum: ["A","B","C","D","E"] },
          comentario_geral: { type: "string" },
          area: { type: "string" },
          dificuldade: { type: "string", enum: ["facil","media","dificil"] },
        },
        required: ["enunciado","alternativas","letra_correta","comentario_geral"],
      },
    },
  },
  required: ["questions"],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return jsonErr(401, "Sem autenticação");

    const userClient = createClient(SUPA_URL, SERVICE_KEY, {
      global: { headers: { Authorization: auth } },
    });
    const svcClient = createClient(SUPA_URL, SERVICE_KEY);

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return jsonErr(401, "Usuário inválido");
    const userId = userData.user.id;

    const { case_id, n: requestedN } = await req.json();
    if (!case_id) return jsonErr(400, "case_id obrigatório");
    const n = Math.max(1, Math.min(10, requestedN ?? 5));

    // Pega o caso
    const { data: caseRow, error: caseErr } = await svcClient
      .from("clinical_cases")
      .select("id, user_id, status, caso_estruturado, titulo")
      .eq("id", case_id)
      .maybeSingle();
    if (caseErr || !caseRow) return jsonErr(404, "Caso não encontrado");
    if (caseRow.user_id !== userId) return jsonErr(403, "Sem acesso");
    if (caseRow.status !== "complete") return jsonErr(400, "Caso ainda não foi finalizado");

    // Pega ordem atual de questões (pra continuar numerando)
    const { count: existingCount } = await svcClient
      .from("clinical_case_questions")
      .select("id", { count: "exact", head: true })
      .eq("case_id", case_id);
    const startOrdem = (existingCount ?? 0) + 1;

    const casoText = JSON.stringify(caseRow.caso_estruturado, null, 2);
    const prompt = `Gere ${n} questão(ões) ENAMED-style baseadas neste caso:\n\n--- CASO ---\nTítulo: ${caseRow.titulo ?? "—"}\n\n${casoText}\n\nUse os campos do caso como base. Misture níveis de dificuldade. Evite questões redundantes entre si.`;

    let lastErr: string | null = null;
    let parsed: any = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        parsed = await claudeJson({
          system: SYSTEM,
          messages: [{ role: "user", content: prompt }],
          jsonSchema: responseSchema,
          maxTokens: 16000,
          effort: "medium",
        });
        break;
      } catch (e) {
        const ce = toClaudeError(e);
        lastErr = `IA ${ce.status}: ${ce.message}`;
        if (!ce.retryable && ce.status !== 429) return jsonErr(502, lastErr);
        await new Promise((r) => setTimeout(r, [1000,3000,9000][attempt] ?? 3000));
      }
    }

    if (!parsed?.questions?.length) return jsonErr(502, `Falha IA: ${lastErr}`);

    const rows = parsed.questions.map((q: any, i: number) => ({
      case_id,
      user_id: userId,
      ordem: startOrdem + i,
      enunciado: q.enunciado,
      alternativas: q.alternativas,
      letra_correta: q.letra_correta,
      comentario_geral: q.comentario_geral ?? null,
      area: q.area ?? null,
      dificuldade: q.dificuldade ?? "media",
    }));

    const { error: insErr } = await svcClient.from("clinical_case_questions").insert(rows);
    if (insErr) return jsonErr(500, insErr.message);

    return new Response(JSON.stringify({ success: true, count: rows.length }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[generate-case-questions] erro:", e);
    return jsonErr(500, String((e as Error).message ?? e));
  }
});

function jsonErr(status: number, message: string) {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
