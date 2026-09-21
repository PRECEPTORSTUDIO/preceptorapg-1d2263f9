import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { claudeSseStream, pdfBlock, textBlock, type ClaudeContentBlock } from "../_shared/claude.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EXAM_PROMPT = `# ROLE
Você é um Coordenador de Avaliação Médica e Professor Titular de uma faculdade de medicina de excelência. Sua missão é elaborar uma PROVA DE EXAME completa.

# REGRA ABSOLUTA DE QUANTIDADE
⚠️ REGRA INVIOLÁVEL: Você DEVE gerar EXATAMENTE {{quantidade}} questões. NÃO gere menos. NÃO gere mais. Se solicitado 30, gere 30. Se solicitado 15, gere 15. Conte as questões enquanto gera. Numere de 1 a {{quantidade}}.

# INPUTS
- **Conteúdo Base:** [Fornecido pelo usuário]
- **Quantidade de Questões:** {{quantidade}} (EXATAMENTE este número, sem exceção)
- **Nível de Dificuldade:** {{nivel}}
- **Referências:** Harrison, Guyton, Robbins, Moore, Goodman & Gilman, Porto.

# ESTRUTURA DA PROVA

## CASOS CLÍNICOS (60% das questões)
Cada caso clínico DEVE conter:
- Identificação (sexo, idade, profissão)
- Queixa principal e HDA detalhada com cronologia
- Antecedentes (comorbidades, medicações, história familiar, hábitos)
- Exame físico com sinais vitais completos (PA, FC, FR, T°, SpO2)
- Exames complementares quando aplicável (valores numéricos)
- Pergunta sobre diagnóstico, fisiopatologia, conduta ou mecanismo

Requisitos:
- Casos verossímeis com dados positivos E negativos
- Distratores plausíveis representando erros comuns de raciocínio
- 20% dos casos devem integrar múltiplos sistemas/temas

## QUESTÕES DE MECANISMO/CONCEITO (40% das questões)
- Fisiologia molecular, anatomia clínica, farmacologia, patologia
- NUNCA memorização pura — sempre exigir raciocínio
- Contextualizar clinicamente quando possível

# REQUISITOS DAS QUESTÕES
- 5 alternativas (A, B, C, D, E) — apenas UMA correta
- Alternativas com tamanho semelhante
- Distratores inteligentes e plausíveis
- Terminologia médica estrita (dispneia, hemoptise, odinofagia)
- Sem pegadinhas superficiais

# DIRETRIZES POR NÍVEL

## Ciclo Básico:
- Ênfase em fisiologia, anatomia, histologia, farmacologia básica
- Apresentações clássicas/típicas
- Foco em mecanismos fundamentais

## Residência/Internato:
- Apresentações atípicas, oligossintomáticas, com comorbidades
- Diagnóstico diferencial fino
- Condutas terapêuticas com nuances
- Cenários de emergência

# FORMATO DE SAÍDA OBRIGATÓRIO

Use EXATAMENTE este formato para CADA questão. NÃO altere o formato.

---

## Questão X
*Tipo: Caso Clínico | Tema: [tema] | Dificuldade: [nível]*

[Enunciado completo]

**A)** [alternativa]
**B)** [alternativa]
**C)** [alternativa]
**D)** [alternativa]
**E)** [alternativa]

<details>
<summary>📋 Gabarito e Explicação</summary>

**Gabarito: [LETRA]**

**Por que a alternativa [LETRA] está correta:**
[Explicação fisiopatológica detalhada]

**Por que as demais estão incorretas:**
- A) [explicação]
- B) [explicação]
- C) [explicação]
- D) [explicação]

**Referência:** [livro e capítulo]
**💡 Pérola:** [insight de estudo]

</details>

---

# DISTRIBUIÇÃO PROPORCIONAL
Distribua as {{quantidade}} questões proporcionalmente entre os temas do conteúdo fornecido. Cada tema deve ter pelo menos 2-3 questões.

# IMPORTANTE
- Gere EXATAMENTE {{quantidade}} questões numeradas de 1 a {{quantidade}}
- NÃO pare antes de completar todas as {{quantidade}} questões
- CADA questão deve ser uma oportunidade de aprendizado profundo
- Os casos clínicos devem ser realistas e desafiadores`;

const CLINICAL_CASE_PROMPT = `# ROLE
Você é um Preceptor Clínico de excelência em uma faculdade de medicina de alto desempenho. Sua tarefa é elaborar um CASO CLÍNICO INTEGRADOR completo e detalhado, baseado no conteúdo acadêmico fornecido, que simule uma situação real de atendimento médico e desafie o estudante a integrar conhecimentos de múltiplas áreas.

# INPUTS
- **Conteúdo Base:** [Fornecido pelo usuário]
- **Nível de Dificuldade:** {{nivel}}
- **Referências:** Harrison, Guyton, Robbins, Moore, Goodman & Gilman, Porto.

# ESTRUTURA OBRIGATÓRIA DO CASO CLÍNICO

## 1. IDENTIFICAÇÃO E CONTEXTUALIZAÇÃO
- Nome fictício, sexo, idade, profissão, estado civil
- Naturalidade e procedência (quando relevante epidemiologicamente)
- Data de admissão fictícia

## 2. QUEIXA PRINCIPAL (QP)
- Uma frase concisa com o motivo da consulta e o tempo de evolução
- Usar as palavras do "paciente" (depois traduzir para terminologia médica)

## 3. HISTÓRIA DA DOENÇA ATUAL (HDA)
- Narrativa cronológica detalhada (mínimo 10-15 linhas)
- Início dos sintomas, evolução temporal, fatores de piora/melhora
- Sintomas associados positivos E negativos relevantes
- Tratamentos prévios tentados e seus resultados
- Impacto funcional na vida do paciente

## 4. INTERROGATÓRIO SOBRE DIVERSOS APARELHOS (ISDA)
- Revisar pelo menos 4-5 sistemas relevantes
- Incluir achados positivos E negativos pertinentes ao diagnóstico diferencial

## 5. ANTECEDENTES
- **Pessoais patológicos:** Comorbidades, cirurgias, internações, alergias
- **Medicações em uso:** Com doses quando relevante
- **Hábitos:** Tabagismo (carga tabágica), etilismo (CAGE se positivo), drogas, atividade física, dieta
- **Familiares:** Doenças hereditárias, causa de óbito de pais/irmãos
- **Ginecológico/Obstétrico** (se aplicável): G_P_A_, método contraceptivo, DUM

## 6. EXAME FÍSICO COMPLETO
- **Estado geral:** Descrição qualitativa
- **Sinais vitais:** PA (mmHg), FC (bpm), FR (irpm), Tax (°C), SpO2 (%), peso, altura, IMC
- **Cabeça e pescoço:** Orofaringe, tireoide, linfonodos, jugulares
- **Aparelho cardiovascular:** Ictus, bulhas, sopros, pulsos periféricos
- **Aparelho respiratório:** Inspeção, percussão, ausculta com detalhes
- **Abdome:** Inspeção, ausculta, percussão, palpação superficial e profunda
- **Membros:** Edema, perfusão, pulsos, sinais de TVP
- **Neurológico:** Nível de consciência, pupilas, força, sensibilidade, reflexos
- **Pele e anexos:** Lesões, coloração, turgor

## 7. EXAMES COMPLEMENTARES
Apresente os resultados em formato de tabela quando possível:
- **Laboratório:** Hemograma completo, bioquímica, marcadores específicos (com valores numéricos e referência)
- **Imagem:** Descrição textual detalhada dos achados (RX, TC, USG, RM)
- **Eletrocardiograma:** Descrição do traçado quando relevante
- **Outros:** Gasometria, urina tipo I, culturas, etc.

## 8. QUESTÕES PARA DISCUSSÃO

Elabore **10 questões de discussão** progressivas, do mais simples ao mais complexo:

1. **Sintetize os dados:** Quais são os achados positivos mais relevantes da anamnese?
2. **Semiologia:** Que achados do exame físico são mais significativos e o que indicam?
3. **Síndromes:** Qual(is) síndrome(s) clínica(s) podem ser identificadas?
4. **Diagnóstico:** Qual o diagnóstico sindrômico e etiológico mais provável? Justifique.
5. **Diagnóstico diferencial:** Liste pelo menos 3 diagnósticos diferenciais e explique como descartá-los.
6. **Fisiopatologia:** Explique detalhadamente o mecanismo fisiopatológico da doença, correlacionando com os achados clínicos.
7. **Exames complementares:** Os exames solicitados foram adequados? Que outros exames seriam pertinentes e por quê?
8. **Tratamento:** Qual a conduta terapêutica inicial (farmacológica e não-farmacológica)? Justifique as escolhas com mecanismo de ação.
9. **Complicações:** Quais complicações devem ser monitoradas e como preveni-las?
10. **Prognóstico:** Quais fatores prognósticos podem ser identificados neste caso?

## 9. GABARITO COMENTADO

Para CADA questão de discussão, forneça uma resposta completa e detalhada com:
- Explicação fisiopatológica
- Correlação com os dados do caso
- Referência bibliográfica
- Clinical Pearl quando aplicável

## 10. REFERÊNCIAS BIBLIOGRÁFICAS
Cite as fontes utilizadas (Harrison, Guyton, Robbins, Porto, Goodman & Gilman, etc.)

# DIRETRIZES DE RIGOR
- Terminologia médica estrita
- Dados numéricos realistas e coerentes
- O caso deve ser clinicamente plausível e internamente consistente
- Incluir "pistas" sutis que permitam ao estudante atento fazer correlações avançadas
- O caso deve integrar conhecimentos de TODOS os conteúdos selecionados quando possível

# DIRETRIZES POR NÍVEL

## Ciclo Básico:
- Apresentação clássica/típica da doença
- Foco em correlação morfofuncional
- Questões enfatizando mecanismos básicos

## Residência/Internato:
- Apresentação atípica ou com comorbidades complicadoras
- Múltiplas possibilidades diagnósticas
- Questões exigindo raciocínio clínico avançado e decisão terapêutica`;

// Input validation
const MAX_CONTENT_LENGTH = 200000;
const MIN_QUESTIONS = 5;
const MAX_QUESTIONS = 100;
const VALID_LEVELS = ["basico", "residencia"];
const VALID_MODES = ["prova", "caso_clinico"];
const RATE_LIMIT_WINDOW_MINUTES = 5;
const RATE_LIMIT_MAX_REQUESTS = 5;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authentication
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
        JSON.stringify({ error: "Token de autenticação inválido" }),
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
      .eq("function_name", "generate-exam")
      .gte("created_at", windowStart);

    if ((count ?? 0) >= RATE_LIMIT_MAX_REQUESTS) {
      return new Response(
        JSON.stringify({ error: `Limite de ${RATE_LIMIT_MAX_REQUESTS} gerações a cada ${RATE_LIMIT_WINDOW_MINUTES} minutos. Aguarde e tente novamente.` }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await serviceClient.from("generation_logs").insert({
      user_id: userData.user.id,
      function_name: "generate-exam",
    });

    // Parse and validate input
    const body = await req.json();
    const { conteudo, quantidade, nivel, modo = "prova", materias: rawMaterias, pdfs: rawPdfs } = body;

    // Modo "topicos livres": user fornece lista de materias OU PDFs em vez de
    // conteudo da biblioteca. Aceita 1 ou ambos.
    const materias: string[] = Array.isArray(rawMaterias)
      ? rawMaterias.filter((m: unknown) => typeof m === "string" && m.trim()).map((m: string) => m.trim()).slice(0, 30)
      : [];

    interface AttachedPdf { name: string; mimeType: string; data: string }
    const MAX_PDFS = 3;
    const MAX_PDF_BASE64 = 7_000_000;
    const pdfs: AttachedPdf[] = [];
    if (Array.isArray(rawPdfs) && rawPdfs.length > 0) {
      if (rawPdfs.length > MAX_PDFS) {
        return new Response(
          JSON.stringify({ error: `Maximo ${MAX_PDFS} PDFs por simulado` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      for (const p of rawPdfs) {
        if (!p || typeof p !== "object") continue;
        if (p.mimeType !== "application/pdf") {
          return new Response(
            JSON.stringify({ error: `Apenas PDF: ${p.mimeType}` }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (!p.data || p.data.length > MAX_PDF_BASE64) {
          return new Response(
            JSON.stringify({ error: "PDF invalido ou maior que 5MB" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        pdfs.push({ name: String(p.name ?? "").slice(0, 200), mimeType: p.mimeType, data: p.data });
      }
    }

    const hasCustomInputs = materias.length > 0 || pdfs.length > 0;
    if (!hasCustomInputs && (!conteudo || typeof conteudo !== "string" || !conteudo.trim())) {
      return new Response(
        JSON.stringify({ error: "Conteúdo é obrigatório (envie matérias, PDFs ou texto base)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Smart truncation: keep headings + key content from each topic.
    // Quando user enviou apenas materias/PDFs (sem texto base), construimos
    // um placeholder textual a partir das materias — a IA ainda usa os PDFs
    // anexados como fonte primaria.
    let sanitizedConteudo: string = typeof conteudo === "string" && conteudo.trim()
      ? conteudo
      : materias.length > 0
        ? `O estudante quer ser avaliado nos seguintes temas/materias:\n\n${materias.map((m, i) => `${i + 1}. ${m}`).join("\n")}\n\nElabore questoes cobrindo CADA um desses temas com profundidade tecnica adequada ao nivel solicitado. Distribua as questoes proporcionalmente entre os temas — nao deixe nenhum tema sem cobertura.`
        : "Use os PDFs anexados como fonte unica do conteudo. Elabore questoes baseadas no que esta neles.";
    if (conteudo.length > MAX_CONTENT_LENGTH) {
      // Split by topic separator and extract key content from each
      const topics = conteudo.split(/\n---\n|\n#{2}\s/);
      const maxPerTopic = Math.floor(MAX_CONTENT_LENGTH / Math.max(topics.length, 1));

      sanitizedConteudo = topics.map((topic: string) => {
        if (topic.length <= maxPerTopic) return topic;
        const lines = topic.split('\n');
        const kept: string[] = [];
        let count = 0;
        let keepNext = true;
        for (const line of lines) {
          if (/^#{1,4}\s/.test(line) || /^\s*[-*•]\s/.test(line)) {
            kept.push(line);
            count += line.length;
            keepNext = true;
          } else if (keepNext && line.trim()) {
            kept.push(line);
            count += line.length;
            keepNext = false;
          } else if (!line.trim()) {
            kept.push('');
          }
          if (count > maxPerTopic) break;
        }
        return kept.join('\n');
      }).join('\n\n---\n\n');
    }

    const sanitizedModo = (typeof modo === "string" && VALID_MODES.includes(modo)) ? modo : "prova";
    const numQuestions = typeof quantidade === "number" ? Math.min(Math.max(quantidade, MIN_QUESTIONS), MAX_QUESTIONS) : 30;
    const sanitizedNivel = (typeof nivel === "string" && VALID_LEVELS.includes(nivel.toLowerCase().trim()))
      ? nivel.toLowerCase().trim()
      : "residencia";

    sanitizedConteudo = sanitizedConteudo.trim().replace(/[\x00-\x1F\x7F]/g, "");

    if (!Deno.env.get("ANTHROPIC_API_KEY")) {
      throw new Error("ANTHROPIC_API_KEY is not configured");
    }

    const nivelLabel = sanitizedNivel === "basico" ? "Ciclo Básico" : "Residência/Internato";

    let systemPrompt: string;
    let userPrompt: string;

    if (sanitizedModo === "caso_clinico") {
      systemPrompt = CLINICAL_CASE_PROMPT
        .replace(/{{nivel}}/g, nivelLabel);

      userPrompt = `**Nível de Dificuldade:** ${nivelLabel}

**Conteúdo Base para elaboração do caso clínico:**

${sanitizedConteudo}

---

Elabore um CASO CLÍNICO INTEGRADOR completo e detalhado baseado no conteúdo acima. O caso deve integrar o máximo de temas possível do conteúdo fornecido. Siga RIGOROSAMENTE toda a estrutura obrigatória do prompt.`;
    } else {
      systemPrompt = EXAM_PROMPT
        .replace(/{{quantidade}}/g, String(numQuestions))
        .replace(/{{nivel}}/g, nivelLabel);

      userPrompt = `**Quantidade de Questões:** EXATAMENTE ${numQuestions} (NÃO gere menos, NÃO gere mais)
**Nível de Dificuldade:** ${nivelLabel}

**Conteúdo Base para elaboração das questões:**

${sanitizedConteudo}

---

⚠️ ATENÇÃO: Elabore EXATAMENTE ${numQuestions} questões numeradas de 1 a ${numQuestions}. 
- Você DEVE gerar TODAS as ${numQuestions} questões, sem exceção.
- 60% casos clínicos detalhados (${Math.round(numQuestions * 0.6)} questões)
- 40% questões de mecanismo/conceito (${Math.round(numQuestions * 0.4)} questões)
- CADA questão DEVE ter justificativa completa dentro de tags <details>
- Use terminologia médica estrita
- NÃO pare antes de completar a questão ${numQuestions}`;
    }

    // Anexa PDFs como blocos `document` (Claude multimodal) — fonte preferencial
    // sobre conhecimento geral. Bloco de instrucao injetado no prompt do user.
    const attachmentBlocks: ClaudeContentBlock[] = pdfs.map(p => pdfBlock(p.data, p.name || undefined));

    let finalUserPrompt = userPrompt;
    if (pdfs.length > 0) {
      finalUserPrompt += `

# ARQUIVOS ANEXADOS PELO ESTUDANTE (FONTE PREFERENCIAL)

O estudante anexou ${pdfs.length} PDF(s) a esta solicitacao:
${pdfs.map((p, i) => `${i + 1}. "${p.name}"`).join("\n")}

Regras:
1. Use o conteudo dos PDFs como **base principal** das questoes. Quando o PDF contiver tema relevante, elabore questoes a partir dele.
2. Mantenha o nivel de dificuldade (${sanitizedNivel === "basico" ? "Ciclo Basico" : "Residencia/Internato"}) e a quantidade exata de questoes.
3. As materias/temas fornecidos pelo estudante (se houver) ainda devem ser cobertos — combine PDFs + materias na elaboracao.`;
    }

    // Chamada ao Claude em streaming, no formato SSE que o frontend consome
    const stream = claudeSseStream({
      system: systemPrompt,
      messages: [{ role: "user", content: [...attachmentBlocks, textBlock(finalUserPrompt)] }],
      maxTokens: 64000,
      effort: "high",
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("generate-exam error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
