// Edge Function: Ingest Prova
// Recebe um prova_id (PDF ja foi upado pra storage 'provas-pdfs').
// Le PDF, manda inline pro Claude com prompt estruturado de extracao,
// parseia questoes e insere em prova_questoes_importadas.
//
// Tambem opcionalmente gera justificativas via IA pra questoes onde o PDF
// nao trouxe explicacao, se o user marcou gerar_justificativa_ia=true.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  type ClaudeContentBlock,
  claudeJson,
  claudeText,
  pdfBlock,
  textBlock,
  toClaudeError,
  userMessage,
} from "../_shared/claude.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const RATE_LIMIT_PER_DAY = 5;
const MAX_PDF_SIZE_BYTES = 20 * 1024 * 1024; // 20MB cap pro PDF inline (limite da API do Claude e 32MB por request)
const MAX_QUESTIONS = 200;

interface ExtractedQuestion {
  numero: number;
  enunciado: string;
  alternativas: string[];
  gabarito: string;
  justificativa: string;
  pagina_origem: number;
  tem_imagem: boolean;
  confianca_baixa: boolean;
  anomalia: boolean;
}

interface ExtractionResult {
  questoes: ExtractedQuestion[];
  tem_gabarito_no_pdf: boolean;
  tem_justificativas_no_pdf: boolean;
}

function buildExtractionPrompt(numAlternativas: number, isText: boolean): string {
  const letraMax = String.fromCharCode(64 + numAlternativas); // 4=>D, 5=>E
  const sourceLabel = isText
    ? "o texto extraido pagina-a-pagina de uma prova"
    : "um PDF de prova";
  return `Voce recebe ${sourceLabel} de medicina (residencia, ENAMED, prova de faculdade, ou similar).
Sua tarefa: extrair TODAS as questoes de multipla escolha presentes.

REGRAS CRITICAS:

1. **Reproducao literal**: copie o ENUNCIADO e cada ALTERNATIVA EXATAMENTE como aparecem no PDF.
   - NAO reformule, NAO corrija portugues/ortografia, NAO simplifique, NAO traduza.
   - Mantenha numeros, doses, unidades, nomes proprios.
   - Mantenha pontuacao e quebras logicas.

2. **Numero de alternativas**: a prova tem ${numAlternativas} alternativas (de A ate ${letraMax}).
   - Se uma questao especifica tem numero diferente de alternativas, ainda extraia mas marque "anomalia": true.

3. **Gabarito**:
   - Procure no final do PDF, em pagina de gabarito, ou comentado apos cada questao.
   - Use exatamente a letra (A, B, C, D${numAlternativas === 5 ? ", E" : ""}).
   - Se nao encontrar gabarito de uma questao, devolva string vazia "" (sera marcada como pending).

4. **Justificativas**:
   - Se o PDF tem comentarios/explicacoes apos cada questao (gabarito comentado), extraia LITERAL.
   - NAO invente, NAO complete frases pela metade, NAO traduza.
   - Se a questao nao tem justificativa no PDF, devolva string vazia "".

5. **Imagens**: ignore figuras, ECG, raio-X, graficos. Se uma questao depende de imagem,
   ainda extraia o texto disponivel e marque "tem_imagem": true.

6. **Numeracao**: use exatamente o numero da questao como aparece (questao 1, 2, ..., 100).

7. **Incerteza**: se voce esta com baixa confianca em algum trecho (PDF borrado, OCR ruim),
   marque "confianca_baixa": true.

8. **Anulada/cancelada**: se a questao tem marcacao de "anulada" ou "cancelada", marque
   "anomalia": true e ainda assim extraia.

FORMATO DE SAIDA — APENAS JSON valido, SEM \`\`\`markdown ou texto adicional:

{
  "questoes": [
    {
      "numero": 1,
      "enunciado": "Texto exato do enunciado...",
      "alternativas": ["A) texto da A", "B) texto da B", "C) texto da C", "D) texto da D"${numAlternativas === 5 ? ', "E) texto da E"' : ""}],
      "gabarito": "C",
      "justificativa": "Texto exato da explicacao (ou string vazia)",
      "pagina_origem": 1,
      "tem_imagem": false,
      "confianca_baixa": false,
      "anomalia": false
    }
  ],
  "tem_gabarito_no_pdf": true,
  "tem_justificativas_no_pdf": false
}

IMPORTANTE: a string de cada alternativa NAO deve incluir o prefixo "A)", "B)", etc — apenas o texto da alternativa.
Exemplo CORRETO: "alternativas": ["Hipertensao essencial", "Hiperaldosteronismo primario", ...]
Exemplo ERRADO:  "alternativas": ["A) Hipertensao essencial", "B) Hiperaldosteronismo primario", ...]`;
}

async function callClaudeExtraction(
  systemPrompt: string,
  source: { type: "text"; pagesText: string } | { type: "pdf"; base64: string },
): Promise<ExtractionResult> {
  const content: ClaudeContentBlock[] =
    source.type === "text"
      ? [
          textBlock(source.pagesText),
          textBlock(
            "Extraia todas as questoes presentes no texto acima seguindo as regras do sistema.",
          ),
        ]
      : [
          pdfBlock(source.base64),
          textBlock("Extraia todas as questoes desta prova seguindo as regras."),
        ];

  try {
    return await claudeJson<ExtractionResult>({
      system: systemPrompt,
      messages: [userMessage(content)],
      jsonOnly: true,
      maxTokens: 64000,
      effort: "medium",
    });
  } catch (e) {
    const ce = toClaudeError(e);
    throw new Error(`Claude API ${ce.status}: ${ce.message.slice(0, 500)}`);
  }
}

async function generateJustificativaIA(
  enunciado: string,
  alternativas: string[],
  gabarito: string,
): Promise<string> {
  const altLetras = alternativas.map((alt, i) =>
    `${String.fromCharCode(65 + i)}) ${alt}`
  ).join("\n");

  const prompt =
    `Questao de prova de medicina:\n\n${enunciado}\n\n${altLetras}\n\nGabarito oficial: ${gabarito}\n\nProduza uma justificativa academica que explique por que a alternativa ${gabarito} esta correta e por que cada uma das outras esta errada. Use linguagem medica precisa, cite mecanismos fisiopatologicos e dados de evidencia quando relevante. NAO invente referencias com pagina/capitulo. Maximo 4 paragrafos densos. Comece direto pelo conteudo, sem cabecalhos.`;

  try {
    const text = await claudeText({
      system:
        "Voce e um Preceptor Academico de Medicina. Justifique respostas de questoes com rigor cientifico e clareza didatica.",
      messages: [{ role: "user", content: prompt }],
      maxTokens: 2048,
      effort: "medium",
    });
    return text.trim();
  } catch {
    return ""; // falha silenciosa — questao fica sem justificativa
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // ── Auth ──
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Autenticacao necessaria" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const token = authHeader.replace("Bearer ", "");

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } },
  );
  // getUser(token) valida no servidor de auth — mais confiavel que
  // getClaims (que exige a chave de assinatura JWT local e falhava
  // com "Token invalido" mesmo com token valido).
  const { data: { user }, error: authError } = await userClient.auth.getUser(token);
  const userId = user?.id;
  if (authError || !userId) {
    console.error("ingest-prova auth error:", authError?.message);
    return new Response(JSON.stringify({ error: "Token invalido" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Service client pra escrever em provas (service-role bypass de RLS)
  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  // ── Subscription/access check ──
  const { data: subscription } = await userClient
    .from("subscriptions")
    .select("status, plan_type, access_expires_at")
    .eq("user_id", userId)
    .maybeSingle();
  const { data: userRole } = await userClient
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  const isAdmin = !!userRole;
  const isExpired = subscription?.access_expires_at
    ? new Date(subscription.access_expires_at).getTime() < Date.now()
    : false;
  const hasAccess = !isExpired &&
    (subscription?.status === "active" ||
      subscription?.plan_type === "free_access");
  if (!hasAccess && !isAdmin) {
    return new Response(
      JSON.stringify({ error: "Assinatura ativa necessaria" }),
      {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // ── Rate limit (5 ingestoes/dia, exceto admin) ──
  if (!isAdmin) {
    const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { count } = await adminClient
      .from("provas_importadas")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", dayAgo);
    if ((count ?? 0) > RATE_LIMIT_PER_DAY) {
      return new Response(
        JSON.stringify({
          error:
            `Limite de ${RATE_LIMIT_PER_DAY} provas por dia atingido. Tente novamente amanha.`,
        }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
  }

  // ── Parse body ──
  // mode "text" (preferido pra PDFs digitais): client manda texto extraido
  //   pagina-a-pagina. Roda em segundos e nao gasta CPU/memoria do worker
  //   processando OCR/Vision.
  // mode "pdf" (fallback automatico, nao implementado por agora): processaria
  //   o PDF original via Claude (documento) quando o texto for insuficiente (scan).
  // Modo chunk: client pode chamar varias vezes com porcoes diferentes do
  // texto. Nao limpamos questoes existentes nem mexemos no status — quem
  // orquestra eh o client. Cada chamada eh idempotente: re-inserir uma
  // questao com mesmo numero faz upsert.
  let body: {
    prova_id?: string;
    mode?: "text" | "pdf";
    pages?: Array<{ page_num: number; text: string }>;
    chunk_index?: number;     // 0-based; usado so pra logging
    total_chunks?: number;
    auto_approve?: boolean;   // se true, status='approved' direto (modo expresso)
    is_first?: boolean;       // se true, edge function marca extracting + apaga questoes antigas
    is_last?: boolean;        // se true, edge function marca reviewing/ready no fim
  };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON invalido" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const provaId = body.prova_id;
  const mode = body.mode ?? "pdf";
  if (!provaId || typeof provaId !== "string") {
    return new Response(JSON.stringify({ error: "prova_id obrigatorio" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (mode === "text") {
    if (
      !Array.isArray(body.pages) ||
      body.pages.length === 0 ||
      body.pages.every((p) => !p.text || p.text.trim().length === 0)
    ) {
      return new Response(
        JSON.stringify({
          error:
            "mode=text requer array 'pages' com texto. PDF parece sem texto extraivel — provavelmente scan.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
  }

  // ── Carrega prova e valida ownership ──
  const { data: prova, error: provaError } = await adminClient
    .from("provas_importadas")
    .select("*")
    .eq("id", provaId)
    .eq("user_id", userId)
    .maybeSingle();
  if (provaError || !prova) {
    return new Response(
      JSON.stringify({ error: "Prova nao encontrada ou nao pertence ao user" }),
      {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
  if (!prova.pdf_storage_path) {
    return new Response(
      JSON.stringify({ error: "PDF nao foi upado ainda pra esta prova" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
  // Bloqueia chamada concorrente em status terminal (ready/archived) salvo
  // se for re-ingestao a partir de failed.
  const allowedStarts = new Set([
    "uploading",
    "extracting",
    "reviewing", // permite adicionar mais chunks no fim
    "failed",
  ]);
  if (!allowedStarts.has(prova.status)) {
    return new Response(
      JSON.stringify({
        error: `Prova esta no status '${prova.status}', nao pode ingerir.`,
      }),
      {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // ── Setup do primeiro chunk: limpa estado antigo + marca extracting ──
  if (body.is_first) {
    await adminClient
      .from("prova_questoes_importadas")
      .delete()
      .eq("prova_id", provaId);
    await adminClient
      .from("provas_importadas")
      .update({
        status: "extracting",
        extraction_started_at: new Date().toISOString(),
        status_message: null,
      })
      .eq("id", provaId);
  }

  try {
    if (!Deno.env.get("ANTHROPIC_API_KEY")) throw new Error("ANTHROPIC_API_KEY nao configurada");

    let result: ExtractionResult;

    if (mode === "text") {
      // Caminho rapido — texto ja extraido no browser via pdfjs.
      // Concatena com marcadores de pagina e manda pro Claude em modo texto.
      const pagesArr = body.pages ?? [];
      const pagesText = pagesArr
        .map((p) =>
          `=== PAGINA ${p.page_num} ===\n${(p.text ?? "").trim()}`
        )
        .join("\n\n");
      // Sanity check de tamanho — Claude aceita ~1M tokens input,
      // mas vamos cortar em ~500k chars pra evitar surpresa.
      if (pagesText.length > 500_000) {
        throw new Error(
          `Texto da prova muito grande (${pagesText.length} chars). Divida em provas menores.`,
        );
      }
      const systemPrompt = buildExtractionPrompt(prova.num_alternativas, true);
      result = await callClaudeExtraction(systemPrompt, {
        type: "text",
        pagesText,
      });
    } else {
      // Caminho lento — PDF Vision (usado quando o caller marca explicitamente
      // mode=pdf, ex: scan sem OCR). Limitado a 20MB e poucas paginas pra
      // nao estourar o wall-clock de 150s do worker.
      const { data: pdfBlob, error: dlError } = await adminClient
        .storage
        .from("provas-pdfs")
        .download(prova.pdf_storage_path);
      if (dlError || !pdfBlob) {
        throw new Error(
          `Falha ao baixar PDF do storage: ${dlError?.message ?? "blob vazio"}`,
        );
      }
      const pdfArrayBuffer = await pdfBlob.arrayBuffer();
      if (pdfArrayBuffer.byteLength > MAX_PDF_SIZE_BYTES) {
        throw new Error(
          `PDF muito grande (${(pdfArrayBuffer.byteLength / 1024 / 1024).toFixed(1)} MB). Limite Vision: ${MAX_PDF_SIZE_BYTES / 1024 / 1024} MB.`,
        );
      }
      const u8 = new Uint8Array(pdfArrayBuffer);
      let binary = "";
      const CHUNK = 0x8000;
      for (let i = 0; i < u8.length; i += CHUNK) {
        binary += String.fromCharCode.apply(
          null,
          Array.from(u8.subarray(i, i + CHUNK)),
        );
      }
      const pdfBase64 = btoa(binary);
      const systemPrompt = buildExtractionPrompt(prova.num_alternativas, false);
      result = await callClaudeExtraction(systemPrompt, {
        type: "pdf",
        base64: pdfBase64,
      });
    }

    if (!Array.isArray(result.questoes) || result.questoes.length === 0) {
      throw new Error("A IA nao extraiu nenhuma questao do PDF");
    }
    if (result.questoes.length > MAX_QUESTIONS) {
      throw new Error(
        `PDF tem ${result.questoes.length} questoes (limite ${MAX_QUESTIONS}). Divida em provas menores.`,
      );
    }

    // ── Insere questoes ──
    const rows: Array<Record<string, unknown>> = [];
    let needIaJustification = 0;
    for (const q of result.questoes) {
      // Normaliza
      const numero = Math.max(1, Math.floor(q.numero));
      const enunciado = String(q.enunciado ?? "").trim();
      let alternativas = (q.alternativas ?? []).map((a) =>
        String(a ?? "").trim()
      );
      // Remove prefixo "A)" "B)" se a IA esquecer a regra
      alternativas = alternativas.map((a) =>
        a.replace(/^\s*[A-Ea-e]\s*[)\.\-:]\s*/, "").trim()
      );

      // Pad/trunca pro num_alternativas correto se vier diferente
      if (alternativas.length !== prova.num_alternativas) {
        if (alternativas.length < prova.num_alternativas) {
          while (alternativas.length < prova.num_alternativas) {
            alternativas.push("");
          }
        } else {
          alternativas = alternativas.slice(0, prova.num_alternativas);
        }
      }

      const gabarito = String(q.gabarito ?? "").trim().toUpperCase();
      const validGabarito = /^[A-E]$/.test(gabarito) &&
        gabarito.charCodeAt(0) - 65 < prova.num_alternativas;

      let justificativa = String(q.justificativa ?? "").trim();
      let justOrigem: "pdf" | "ia" | "none" = justificativa
        ? "pdf"
        : "none";

      if (!justificativa && prova.gerar_justificativa_ia && validGabarito) {
        needIaJustification++;
      }

      // Modo expresso: aprova direto pra entrar no simulado live
      const defaultStatus = body.auto_approve ? "approved" : "pending";

      if (!enunciado || !validGabarito) {
        rows.push({
          prova_id: provaId,
          user_id: userId,
          numero,
          enunciado: enunciado || "[ENUNCIADO NAO EXTRAIDO]",
          alternativas,
          gabarito: validGabarito ? gabarito : "A",
          justificativa: justificativa || null,
          justificativa_origem: justOrigem,
          status: "rejected",
          pagina_origem: q.pagina_origem ?? null,
          raw_extraction: q,
        });
        continue;
      }

      rows.push({
        prova_id: provaId,
        user_id: userId,
        numero,
        enunciado,
        alternativas,
        gabarito,
        justificativa: justificativa || null,
        justificativa_origem: justOrigem,
        status: defaultStatus,
        pagina_origem: q.pagina_origem ?? null,
        raw_extraction: q,
      });
    }

    // Dedupe numero — se a IA repetir, mantem ultima
    const byNumero = new Map<number, Record<string, unknown>>();
    for (const row of rows) byNumero.set(row.numero as number, row);
    const dedupedRows = Array.from(byNumero.values()).sort(
      (a, b) => (a.numero as number) - (b.numero as number),
    );

    // Upsert por (prova_id, numero) — chunk pode trazer questao que outro
    // chunk ja inseriu se houver overlap; mantem a versao mais nova.
    const { error: insError } = await adminClient
      .from("prova_questoes_importadas")
      .upsert(dedupedRows, { onConflict: "prova_id,numero" });
    if (insError) throw new Error(`Falha ao inserir questoes: ${insError.message}`);

    // ── Gera justificativas IA pra quem precisa (assincrono em paralelo, max 5 simultaneos) ──
    if (needIaJustification > 0) {
      const targets = dedupedRows.filter((r) =>
        !r.justificativa &&
        prova.gerar_justificativa_ia &&
        r.status === "pending"
      );
      // Limita pra nao explodir o tempo da function
      const TO_GENERATE = targets.slice(0, 50);
      for (let i = 0; i < TO_GENERATE.length; i += 5) {
        const batch = TO_GENERATE.slice(i, i + 5);
        await Promise.all(
          batch.map(async (r) => {
            const just = await generateJustificativaIA(
              r.enunciado as string,
              r.alternativas as string[],
              r.gabarito as string,
            );
            if (just) {
              await adminClient
                .from("prova_questoes_importadas")
                .update({
                  justificativa: just,
                  justificativa_origem: "ia",
                })
                .eq("prova_id", provaId)
                .eq("numero", r.numero);
            }
          }),
        );
      }
    }

    // ── Finaliza chunk ──
    if (body.is_last) {
      // Se modo expresso, todas ja sao approved -> ready.
      // Se nao, vai pra reviewing (user decide).
      const finalStatus = body.auto_approve ? "ready" : "reviewing";
      await adminClient
        .from("provas_importadas")
        .update({
          status: finalStatus,
          extraction_completed_at: new Date().toISOString(),
        })
        .eq("id", provaId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        prova_id: provaId,
        chunk_index: body.chunk_index ?? 0,
        questoes_extraidas: dedupedRows.length,
        questoes_com_justificativa_pdf: dedupedRows.filter((r) =>
          r.justificativa_origem === "pdf"
        ).length,
        questoes_pendentes_ia: needIaJustification,
        tem_gabarito_no_pdf: result.tem_gabarito_no_pdf,
        tem_justificativas_no_pdf: result.tem_justificativas_no_pdf,
        is_last: !!body.is_last,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = (err as Error).message ?? "Erro desconhecido";
    console.error("ingest-prova fail:", msg);
    await adminClient
      .from("provas_importadas")
      .update({
        status: "failed",
        status_message: msg.slice(0, 500),
      })
      .eq("id", provaId);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
