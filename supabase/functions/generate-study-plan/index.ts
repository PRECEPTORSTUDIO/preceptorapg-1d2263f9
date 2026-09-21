// Edge function: gera cronograma de estudo dia-a-dia via Claude.
// Input: { prova_nome, prova_data, topicos_input, horas_dia }
// Output: cria study_plans + study_plan_days; retorna plan_id
//
// Lógica de distribuição:
//   - 65% dias = aprendizado (conteúdo novo + flashcards do tema)
//   - 25% = consolidação (revisão flashcards + simulado curto)
//   - 10% finais = revisão final (simulado completo + revisão geral)
//   - últimos 1-2 dias = descanso leve

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { claudeJson, toClaudeError, CLAUDE_MODEL } from "../_shared/claude.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface ReqBody {
  prova_nome: string;
  prova_data: string; // YYYY-MM-DD
  topicos_input: string;
  horas_dia: number;
}

interface AtividadeIA {
  tipo: "fechamento" | "flashcards" | "questoes" | "revisao_flash" | "leitura";
  tema: string;
  descricao: string;
  estimativa_min: number;
  quantidade?: number;
}

interface DiaIA {
  data: string;
  topico_principal: string;
  fase: "aprendizado" | "consolidacao" | "revisao_final" | "descanso";
  atividades: AtividadeIA[];
}

function dateRange(start: Date, end: Date): string[] {
  const days: string[] = [];
  const cur = new Date(start);
  cur.setUTCHours(0, 0, 0, 0);
  while (cur <= end) {
    days.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return days;
}

function classifyPhase(diaIdx: number, totalDias: number): DiaIA["fase"] {
  const pctRestante = (totalDias - diaIdx) / totalDias;
  if (totalDias - diaIdx <= 1) return "descanso";
  if (totalDias - diaIdx <= 4) return "revisao_final";
  if (pctRestante < 0.3) return "consolidacao";
  return "aprendizado";
}

const planSchema = {
  type: "object",
  properties: {
    topicos_normalizados: {
      type: "array",
      items: { type: "string" },
      description: "Lista de tópicos do estudante normalizada (ex: 'cardio' → 'Cardiologia'; 'icc' → 'Insuficiência Cardíaca')",
    },
    distribuicao: {
      type: "array",
      description: "Para cada dia já com fase pré-definida, retorne o tópico principal e atividades concretas.",
      items: {
        type: "object",
        properties: {
          data: { type: "string" },
          topico_principal: { type: "string" },
          atividades: {
            type: "array",
            minItems: 1,
            maxItems: 5,
            items: {
              type: "object",
              properties: {
                tipo: { type: "string", enum: ["fechamento", "flashcards", "questoes", "revisao_flash", "leitura"] },
                tema: { type: "string", description: "Tema específico (ex: 'IAM com supra de ST')" },
                descricao: { type: "string", description: "Frase curta acionável (1 linha)" },
                estimativa_min: { type: "number" },
                quantidade: { type: "number", description: "Quando aplicável (ex: 3 questões, 10 flashcards)" },
              },
              required: ["tipo", "tema", "descricao", "estimativa_min"],
            },
          },
        },
        required: ["data", "topico_principal", "atividades"],
      },
    },
  },
  required: ["topicos_normalizados", "distribuicao"],
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

    // Gate: usuario com acesso ativo (paid OU free_access) OU admin.
    // free_access é concedido manualmente (founders, comp, beta) — tem
    // mesma experiencia que paid. Antes era bloqueado, gerando 403 confuso.
    const { data: sub } = await svcClient
      .from("subscriptions")
      .select("status, plan_type, access_expires_at")
      .eq("user_id", userId)
      .maybeSingle();

    const isExpired = sub?.access_expires_at
      ? new Date(sub.access_expires_at).getTime() < Date.now()
      : false;
    const hasActiveAccess = !isExpired && sub?.status === "active" &&
      sub?.plan_type && sub.plan_type !== "none";

    const { data: roleRow } = await svcClient.from("user_roles").select("role").eq("user_id", userId).maybeSingle();
    const isAdmin = roleRow?.role === "admin";

    if (!hasActiveAccess && !isAdmin) {
      return jsonErr(403, "Cronograma é exclusivo para assinantes ativos. Faça upgrade para criar seu plano de estudos.");
    }

    const body: ReqBody = await req.json();
    if (!body.prova_nome || !body.prova_data || !body.topicos_input) {
      return jsonErr(400, "Faltam campos obrigatórios");
    }
    const horas = Math.max(1, Math.min(8, body.horas_dia ?? 2));

    const provaDate = new Date(body.prova_data + "T00:00:00Z");
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    if (provaDate <= today) {
      return jsonErr(400, "Data da prova deve ser no futuro");
    }
    const diasDisp = dateRange(today, provaDate);
    if (diasDisp.length > 180) {
      return jsonErr(400, "Cronograma máximo de 180 dias");
    }

    // Pré-classifica fases por dia
    const total = diasDisp.length;
    const skeleton = diasDisp.map((d, idx) => ({
      data: d,
      fase: classifyPhase(idx, total),
    }));

    // ===== Chamada IA — em JANELAS de dias =====
    // Planos longos (até 180 dias) estouravam o maxOutputTokens num único
    // JSON -> truncava -> "Erro ao gerar plano". Geramos a distribuição em
    // janelas de 25 dias (cada uma cabe folgado nos tokens). A 1ª janela
    // tambem normaliza os tópicos; as seguintes recebem essa lista.
    const CHUNK = 25;

    const baseRules = `Tipos de atividade: "fechamento" (resumo PBL, ~25-30min), "flashcards" (deck 8-12 cards, ~15-20min), "questoes" (simulado N questões 3-10, ~5min/q), "revisao_flash" (revisar flashcards, ~10-15min), "leitura" (diretrizes/Harrison, ~30min).
Fases (já definidas em cada dia):
- "aprendizado": 1 fechamento + 1 flashcards + 1 questoes (3-5 q)
- "consolidacao": 1 fechamento curto OU revisão + flashcards + questoes
- "revisao_final": SOMENTE revisao_flash + questoes (5-10 q misturadas)
- "descanso": 1 atividade leve (revisao_flash 15min) + descanso
Regras: cada dia 1 tópico principal + 2-4 atividades que cabem em ~${horas}h. NÃO repita o mesmo tema 2 dias seguidos. Temas específicos ("ICC com fração de ejeção reduzida", não "ICC"). Linguagem BR informal. Descrição = 1 linha acionável.`;

    async function generateChunk(
      skel: { data: string; fase: string }[],
      isFirst: boolean,
      topicosNorm: string[],
    ): Promise<{ topicos_normalizados: string[]; distribuicao: DiaIA[] }> {
      const sys = `Você é tutor de medicina brasileiro criando um cronograma para a prova "${body.prova_nome}" em ${body.prova_data} (${total} dias no total), ${horas}h/dia.

${baseRules}

${isFirst
  ? `Normalize os tópicos do estudante (corrija abreviações: "cardio"→"Cardiologia"; expanda siglas: "ICC"→"Insuficiência Cardíaca"; agrupe sinônimos) e devolva em "topicos_normalizados".`
  : `Tópicos já normalizados (use SOMENTE estes, devolva a mesma lista em "topicos_normalizados"): ${JSON.stringify(topicosNorm)}`}

Gere "distribuicao" APENAS para os ${skel.length} dias informados (não invente outras datas). Distribua os tópicos cobrindo todos antes de revisar. Responda APENAS o JSON do schema.`;

      const usr = `Tópicos brutos do estudante: """${body.topicos_input}"""\nHoras/dia: ${horas}h\nDias desta janela (com fase): ${JSON.stringify(skel)}`;

      let err = "";
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const p = await claudeJson<{ topicos_normalizados: string[]; distribuicao: DiaIA[] }>({
            system: sys,
            messages: [{ role: "user", content: usr }],
            jsonSchema: planSchema,
            maxTokens: 24000,
            effort: "high",
          });
          if (p?.distribuicao?.length) return p;
          err = "distribuicao vazia";
        } catch (e) {
          const ce = toClaudeError(e);
          err = `IA ${ce.status}: ${ce.message}`;
          console.warn("[generate-study-plan] chunk attempt", attempt, err);
          if (!ce.retryable && ce.status !== 429) throw new Error(err);
          await new Promise((r) => setTimeout(r, [1000, 3000, 8000][attempt] ?? 3000));
        }
      }
      throw new Error(`Falha na janela de dias: ${err}`);
    }

    const windows: { data: string; fase: string }[][] = [];
    for (let i = 0; i < skeleton.length; i += CHUNK) {
      windows.push(skeleton.slice(i, i + CHUNK));
    }

    let parsed: { topicos_normalizados: string[]; distribuicao: DiaIA[] };
    try {
      const firstChunk = await generateChunk(windows[0], true, []);
      const topicosNorm = firstChunk.topicos_normalizados ?? [];
      const allDist: DiaIA[] = [...firstChunk.distribuicao];
      for (let i = 1; i < windows.length; i++) {
        const c = await generateChunk(windows[i], false, topicosNorm);
        allDist.push(...c.distribuicao);
      }
      parsed = { topicos_normalizados: topicosNorm, distribuicao: allDist };
    } catch (e) {
      console.error("[generate-study-plan] falha final:", e);
      return jsonErr(502, `Falha ao gerar plano: ${(e as Error).message ?? e}`);
    }

    if (!parsed.distribuicao || parsed.distribuicao.length === 0) {
      return jsonErr(502, "Falha ao gerar plano: distribuição vazia");
    }

    // ===== Marcar plano anterior como abandonado se existir =====
    await svcClient
      .from("study_plans")
      .update({ status: "abandoned" })
      .eq("user_id", userId)
      .eq("status", "active");

    // ===== Inserir plano =====
    const { data: planRow, error: planErr } = await svcClient
      .from("study_plans")
      .insert({
        user_id: userId,
        prova_nome: body.prova_nome,
        prova_data: body.prova_data,
        topicos_input: body.topicos_input,
        topicos_normalizados: parsed.topicos_normalizados ?? [],
        horas_dia: horas,
        status: "active",
        raw_plan: parsed,
        generation_meta: { model: CLAUDE_MODEL, windows: windows.length, chunk_days: CHUNK },
      })
      .select()
      .single();

    if (planErr || !planRow) {
      return jsonErr(500, `Falha ao salvar plano: ${planErr?.message ?? ""}`);
    }

    // ===== Inserir dias =====
    const skelMap = new Map(skeleton.map((s) => [s.data, s.fase]));
    const dayRows = parsed.distribuicao
      .filter((d) => skelMap.has(d.data))
      .map((d) => ({
        plan_id: planRow.id,
        user_id: userId,
        data: d.data,
        topico_principal: d.topico_principal,
        fase: skelMap.get(d.data),
        atividades: (d.atividades ?? []).map((a) => ({
          ...a,
          concluida: false,
          completed_at: null,
          item_ref: null,
        })),
        concluido_pct: 0,
      }));

    const { error: daysErr } = await svcClient.from("study_plan_days").insert(dayRows);
    if (daysErr) {
      console.error("[generate-study-plan] falha ao inserir dias:", daysErr);
      return jsonErr(500, `Falha ao salvar dias: ${daysErr.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        plan_id: planRow.id,
        total_dias: dayRows.length,
        topicos_normalizados: parsed.topicos_normalizados,
      }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[generate-study-plan] erro:", e);
    return jsonErr(500, String((e as Error).message ?? e));
  }
});

function jsonErr(status: number, message: string) {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
