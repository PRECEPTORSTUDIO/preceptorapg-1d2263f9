import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { claudeStreamText, toClaudeError } from "../_shared/claude.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ENAMED_PROMPT = `# ROLE
Você é um elaborador SÊNIOR de questões para o ENAMED (Exame Nacional de Avaliação da Formação Médica), vinculado ao INEP. Sua missão é elaborar questões de ALTO NÍVEL DE DIFICULDADE no EXATO estilo ENAMED 2025/2026, simulando as questões mais desafiadoras da prova.

# NÍVEL DE DIFICULDADE — ALTO (OBRIGATÓRIO)
⚠️ TODAS as questões devem ser de nível DIFÍCIL. NÃO gere questões fáceis ou básicas.

## Critérios de dificuldade obrigatórios:
1. **Vinhetas clínicas EXTENSAS** (mínimo 12-15 linhas): paciente com múltiplas comorbidades, dados laboratoriais completos com valores numéricos específicos, sinais vitais detalhados, história patológica pregressa complexa
2. **Dados distratores abundantes**: inclua informações irrelevantes misturadas aos dados-chave para testar capacidade de filtragem e raciocínio clínico
3. **Distratores ALTAMENTE plausíveis**: as 3 alternativas incorretas devem representar condutas/diagnósticos que seriam corretos em cenários ligeiramente diferentes — exigindo diferenciação fina
4. **Raciocínio em múltiplas etapas**: o aluno deve primeiro identificar o diagnóstico, depois a complicação, e só então a conduta — NÃO questões de diagnóstico direto
5. **Armadilhas clássicas**: inclua situações onde a resposta "mais óbvia" está errada (ex: contraindicações sutis, exceções a guidelines, condutas específicas para subpopulações)
6. **Exames laboratoriais com valores limítrofes**: use valores próximos aos pontos de corte para exigir interpretação precisa
7. **Cenários atípicos**: apresentações atípicas de doenças comuns (ex: IAM sem dor torácica, pneumonia afebril no idoso)
8. **Integração entre especialidades**: questões que exigem conhecimento de múltiplas áreas simultaneamente

# CARACTERÍSTICAS OBRIGATÓRIAS DO ESTILO ENAMED

1. **4 alternativas (A, B, C, D)** — apenas UMA correta
2. **Vinhetas Clínicas Detalhadas** com cenários complexos e realistas
3. **Enunciados longos e densos** com excesso de dados para confundir
4. **Foco em CONDUTA e MANEJO** — não memorização pura, mas aplicação de guidelines em cenários complexos
5. **Ambiguidade calculada** — todas as alternativas devem parecer razoáveis à primeira vista
6. **Baseado em diretrizes ATUAIS** (SBC, FEBRASGO, SBP, MS, AHA, ACOG, ATLS, PALS)
7. **Terminologia médica formal e precisa**

# ÁREAS E TEMAS MAIS COBRADOS (Dados INEP 2011-2025)

## Pediatria (14,90%): Puericultura, Neonatologia, Pneumologia Pediátrica, Imunizações, Aleitamento Materno, Icterícia/Sepse Neonatal, Febre Reumática
## Cirurgia (13,57%): Trauma (ATLS), Urgências Abdominais, Cirurgia Infantil, Urologia, Complicações Pós-operatórias, Queimaduras
## Preventiva/Saúde Coletiva (11,40%): Epidemiologia, SUS, Ética Médica, MFC, Saúde do Trabalhador, Vigilância em Saúde
## Obstetrícia (9,92%): Distúrbios Hipertensivos, Sangramento 1ª/2ª metade, Pré-natal, Diabetes Gestacional, Sífilis Congênita, HPP
## Ginecologia (9,81%): Rastreamento Ca colo/mama, Planejamento Familiar, Vulvovaginites, SUA, Violência Sexual, Endometriose
## Infectologia (8,17%): Arboviroses (Dengue), Tuberculose, HIV, Meningites, Parasitoses, Animais Peçonhentos
## Gastroenterologia (4,45%): DUP, Neoplasias digestivas, DII, Pancreatite, DRGE
## Endocrinologia (3,71%): DM (insulinoterapia, CAD, complicações), Tireoide, Obesidade
## Psiquiatria (3,71%): Dependência Química, Transtornos de Humor, Intoxicações, Psiquiatria Infantil
## Cardiologia (3,45%): Arritmias (FA/Flutter), HAS, SCA, IAM, PCR, IC, Valvopatias
## Neurologia (2,44%): Coma, Cefaleias, AVC, TCE, Distúrbios do Movimento
## Nefrologia (2,28%): ITU, Glomerulopatias, DRC, LRA, DHE
## Hematologia (2,01%): Hemoglobinopatias, Linfomas, Hemostasia, Anemias
## Pneumologia (1,70%): Asma, DPOC, Derrame Pleural, Ca Pulmão, TEP
## Reumatologia (1,48%): LES, EA, AR, Artrites Infecciosas
## Dermatologia (1,48%): Dermatoses Infecciosas, Ca Pele, Hanseníase
## Hepatologia (1,17%): Hepatites Virais, Complicações da Cirrose
## Ortopedia (1,11%): Coluna, Fraturas, Politrauma Ortopédico
## ORL (1,11%): IVAS, Sinusite, Otite
## Oftalmologia (0,90%): Olho Vermelho, Glaucoma, Trauma Ocular

# REGRA DE QUANTIDADE
⚠️ Gere EXATAMENTE {{quantidade}} questões. Numere de 1 a {{quantidade}}.

# DISTRIBUIÇÃO
{{distribuicao}}

# REGRA CRÍTICA DE CONSISTÊNCIA DO GABARITO (feedback recorrente de alunos)
Erro grave atual: a letra do **Gabarito** às vezes NÃO corresponde à alternativa
que realmente contém a resposta correta. Isso destrói a confiança do aluno.

PROCESSO OBRIGATÓRIO para CADA questão (siga nesta ordem):
1. Decida primeiro QUAL É a conduta/resposta clinicamente correta (o conteúdo).
2. Escreva as 4 alternativas A–D. Coloque a resposta correta em UMA delas.
3. Olhe EXATAMENTE em qual letra (A/B/C/D) você escreveu a resposta correta.
4. O campo **Gabarito** DEVE ser essa letra — confira o texto, não a posição.
5. No campo "Resposta correta", copie o texto da alternativa do gabarito PALAVRA
   POR PALAVRA. Se o texto que você copiou não for a conduta correta que você
   decidiu no passo 1, VOCÊ ERROU A LETRA — corrija o **Gabarito** antes de seguir.
6. O **Comentário** deve justificar exatamente essa alternativa. Se o comentário
   defende uma conduta diferente da alternativa do gabarito, há inconsistência —
   corrija a letra.

NUNCA gere uma questão onde gabarito, texto transcrito e comentário discordem.

# FORMATO DE SAÍDA OBRIGATÓRIO

---

## Questão X
*Área: [área] | ENAMED {{ano}}*

[Enunciado clínico EXTENSO e detalhado — mínimo 12-15 linhas para casos clínicos, com dados laboratoriais completos, sinais vitais, história patológica pregressa e dados distratores]

**A)** [alternativa plausível e detalhada]
**B)** [alternativa plausível e detalhada]
**C)** [alternativa plausível e detalhada]
**D)** [alternativa plausível e detalhada]

<details>
<summary>📋 Gabarito e Comentário</summary>

**Gabarito: [LETRA]**

**Resposta correta (transcreva PALAVRA POR PALAVRA o texto da alternativa [LETRA] exatamente como escrita acima):** [texto idêntico da alternativa correta]

**Comentário:**
[Explicação detalhada e aprofundada do raciocínio clínico, citando guidelines específicos, explicando por que este cenário exige esta conduta específica]

**Por que as demais estão incorretas:**
- A) [explicação detalhada com o cenário em que SERIA correta]
- B) [explicação detalhada com o cenário em que SERIA correta]
- C) [explicação detalhada com o cenário em que SERIA correta]

**💡 Ponto-chave:** [insight de estudo avançado, com referência a guideline ou conceito fisiopatológico]

**⚠️ Armadilha:** [explicação da armadilha da questão e como evitar o erro mais comum]

</details>

---

# DIRETRIZES DE QUALIDADE MÁXIMA
- Enunciados REALISTAS e EXTENSOS com dados completos de sinais vitais, exames laboratoriais com valores numéricos ESPECÍFICOS
- ABUNDÂNCIA de dados irrelevantes misturados aos dados-chave (como na prova real do INEP)
- Distratores devem representar ERROS COMUNS de raciocínio médico e condutas de outras patologias similares
- NÃO inclua questões simples ou diretas — TODAS devem exigir raciocínio clínico em múltiplas etapas
- Inclua questões sobre condutas em emergência com dados hemodinâmicos completos
- Foco em temas de ALTA INCIDÊNCIA no ENAMED: Dengue (classificação de risco), Sepse (critérios SOFA/qSOFA), TB (esquemas e resistência), HAS (metas e associações), DM (CAD vs EHH), Trauma (ATLS), Pré-eclâmpsia, Rastreamento oncológico
- Inclua cenários com CONTRAINDICAÇÕES e EXCEÇÕES a condutas padrão
- Questões devem testar a capacidade de PRIORIZAÇÃO (o que fazer PRIMEIRO)`;

const AREAS_MAP: Record<string, string> = {
  clinica_medica: "Clínica Médica",
  cirurgia: "Cirurgia",
  ginecologia_obstetricia: "Ginecologia e Obstetrícia",
  pediatria: "Pediatria",
  saude_coletiva: "Saúde Coletiva",
};

const MAX_CONTENT_LENGTH = 50000;
const RATE_LIMIT_WINDOW_MINUTES = 5;
const RATE_LIMIT_MAX_REQUESTS = 5;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Autenticação necessária" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !userData.user) {
      return new Response(
        JSON.stringify({ error: "Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check subscription
    const { data: subscription } = await supabaseClient
      .from("subscriptions")
      .select("status, plan_type, access_expires_at")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    const { data: userRole } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();

    const isAdmin = !!userRole;
    const isExpired = subscription?.access_expires_at
      ? new Date(subscription.access_expires_at).getTime() < Date.now()
      : false;
    const hasActiveSubscription = !isExpired && (
      subscription?.status === "active" || subscription?.plan_type === "free_access"
    );

    if (!hasActiveSubscription && !isAdmin) {
      return new Response(
        JSON.stringify({ error: "Assinatura ativa necessária" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Rate limiting
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000).toISOString();
    const { count } = await serviceClient
      .from("generation_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userData.user.id)
      .eq("function_name", "generate-enamed")
      .gte("created_at", windowStart);

    if ((count ?? 0) >= RATE_LIMIT_MAX_REQUESTS) {
      return new Response(
        JSON.stringify({ error: `Limite de ${RATE_LIMIT_MAX_REQUESTS} gerações a cada ${RATE_LIMIT_WINDOW_MINUTES} minutos.` }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await serviceClient.from("generation_logs").insert({
      user_id: userData.user.id,
      function_name: "generate-enamed",
    });

    const body = await req.json();
    const { quantidade, area, conteudo_extra } = body;

    const numQuestions = typeof quantidade === "number" ? Math.min(Math.max(quantidade, 5), 100) : 20;
    const sanitizedArea = area && AREAS_MAP[area] ? area : null;

    let distribuicao: string;
    if (sanitizedArea) {
      distribuicao = `Todas as ${numQuestions} questões devem ser de ${AREAS_MAP[sanitizedArea]}.`;
    } else {
      const perArea = Math.floor(numQuestions / 5);
      const remainder = numQuestions - perArea * 5;
      distribuicao = `Distribua proporcionalmente entre as 5 áreas (~${perArea} questões cada, ${remainder > 0 ? `+${remainder} em Clínica Médica` : ""}).`;
    }

    if (!Deno.env.get("ANTHROPIC_API_KEY")) {
      throw new Error("ANTHROPIC_API_KEY not configured");
    }

    const systemPrompt = ENAMED_PROMPT
      .replace(/{{quantidade}}/g, String(numQuestions))
      .replace(/{{distribuicao}}/g, distribuicao)
      .replace(/{{ano}}/g, "2025/2026");

    const refContent = (conteudo_extra && typeof conteudo_extra === "string" && conteudo_extra.trim())
      ? conteudo_extra.trim().slice(0, MAX_CONTENT_LENGTH)
      : "";

    // ── GERAÇÃO EM LOTES ──────────────────────────────────────────────
    // Gerar 90 questões numa única chamada fazia o modelo perder coerência
    // na cauda (ex: questão 65 com enunciado de neuro mas comentário de
    // SIBO — casos clínicos misturados). Lotes pequenos mantêm cada
    // questão internamente consistente. Chamadas sequenciais, output
    // concatenado num único stream pro frontend (UX inalterada).
    const BATCH_SIZE = 12;
    const batches: { start: number; count: number }[] = [];
    for (let s = 1; s <= numQuestions; s += BATCH_SIZE) {
      batches.push({ start: s, count: Math.min(BATCH_SIZE, numQuestions - s + 1) });
    }

    function batchUserPrompt(start: number, count: number): string {
      const end = start + count - 1;
      let p = `Gere as questões de número ${start} a ${end} (EXATAMENTE ${count} questões nesta resposta) no estilo ENAMED 2025/2026.`;
      p += ` Numere-as começando em "## Questão ${start}" e terminando em "## Questão ${end}".`;
      if (sanitizedArea) p += ` Todas da área de ${AREAS_MAP[sanitizedArea]}.`;
      else p += ` ${distribuicao}`;
      if (refContent) p += `\n\nConteúdo de referência para basear as questões:\n${refContent}`;
      p += `\n\n⚠️ REGRA CRÍTICA: cada questão deve ser 100% autocontida — o enunciado, as 4 alternativas, o gabarito e TODO o comentário devem tratar do MESMO caso clínico. NUNCA misture o caso de uma questão com o comentário de outra. Gere as ${count} questões completas, não pare antes.`;
      return p;
    }

    const encoder = new TextEncoder();

    /** Gera um lote em streaming, repassando os deltas no formato SSE do frontend. */
    async function streamBatch(controller: ReadableStreamDefaultController, start: number, count: number): Promise<void> {
      await claudeStreamText(
        {
          system: systemPrompt,
          messages: [{ role: "user", content: batchUserPrompt(start, count) }],
          maxTokens: 32000,
          effort: "high",
        },
        (delta) => {
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({ choices: [{ delta: { content: delta } }] })}\n\n`
          ));
        },
      );
    }

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for (let i = 0; i < batches.length; i++) {
            if (i > 0) {
              // Separador entre lotes garante que o parser não cole a última
              // questão de um lote com a primeira do próximo.
              controller.enqueue(encoder.encode(
                `data: ${JSON.stringify({ choices: [{ delta: { content: "\n\n---\n\n" } }] })}\n\n`
              ));
            }
            let ok = false;
            for (let attempt = 0; attempt < 2 && !ok; attempt++) {
              try {
                await streamBatch(controller, batches[i].start, batches[i].count);
                ok = true;
              } catch (e) {
                const ce = toClaudeError(e);
                console.error("batch", i, "status", ce.status, ce.message);
                if (!ce.retryable) break;
                await new Promise((x) => setTimeout(x, 1500));
              }
            }
          }
        } catch (e) {
          console.error("enamed stream error:", e);
        } finally {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("generate-enamed error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
