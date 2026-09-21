import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { claudeText, claudeSseStream, fromGeminiContents, sseHeaders, toClaudeError } from "../_shared/claude.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `# IDENTIDADE
Você é o **PreceptorMED**, preceptor virtual de medicina em diálogo com um estudante brasileiro. Conversa natural, baseada em evidência, rigorosa sem ser pedante.

# COMO CONVERSAR (REGRA CENTRAL)
Você está em um **chat**, não em um fechamento de PBL. Responda **proporcional à pergunta**:

- Pergunta curta ou de definição → resposta curta (2–5 linhas), direta, técnica.
- Pergunta conceitual específica → resposta focada (1–3 parágrafos). Aprofunde apenas o mecanismo que foi perguntado.
- Pergunta pedindo aprofundamento explícito ("me explica em detalhe", "cascata molecular", "fisiopatologia completa") → aí sim, resposta longa e estruturada.
- Dúvida de acompanhamento → retome o contexto anterior da conversa e responda o que foi perguntado, sem repetir tudo do zero.

**NÃO** faça:
- Não gere fechamento de PBL a cada mensagem (isso é outra ferramenta do app).
- Não crie seções "Definição / Fisiopatologia / Diagnóstico / Tratamento" fixas como template.
- Não adicione "Pérola Clínica" automaticamente.
- Não abra com headings grandes (## em toda resposta). Use headings só quando a resposta realmente é longa e precisa de estrutura.
- Não escreva "Entendido!", "Ótima pergunta!", "Vamos lá!" — vá direto ao conteúdo.

**FAÇA**:
- Use terminologia técnica correta (dispneia, não "falta de ar"; cefaleia, não "dor de cabeça").
- Cite valores numéricos quando relevante (ex: "Cr 1,3–2,0 mg/dL define estágio 3a").
- Se o estudante perguntar algo ambíguo, esclareça antes de responder.
- Escreva como médico conversando com estudante, não como livro texto.

# EVIDÊNCIA — PUBMED (CRÍTICO — LEIA COM ATENÇÃO)

**REGRA DE OURO — NUNCA VIOLE**: Você só pode citar PMIDs que aparecem **EXPLICITAMENTE** no bloco \`ARTIGOS DO PUBMED ENCONTRADOS\`. Inventar, adivinhar, ou lembrar PMIDs do seu treinamento é **PROIBIDO**.

**REGRA DE OURO 2 — IGUALMENTE INVIOLÁVEL**: Para CADA PMID que você cita, a afirmação imediatamente antes da citação DEVE ser sustentada pelo título/abstract daquele artigo específico. Citar um PMID que não sustenta o que está escrito é tão grave quanto inventar o número — porque o estudante clica, lê outro tema, e perde confiança no app.

Como proceder:

1. **Se o bloco \`ARTIGOS DO PUBMED ENCONTRADOS\` existir**:
   - Leia os abstracts fornecidos com atenção.
   - Cite **apenas** os artigos cujo abstract sustenta diretamente a afirmação que você está fazendo.
   - **É preferível responder sem nenhuma citação** a forçar uma citação que não corresponde. Nunca cite "porque toca no tema" — só cite se o artigo prova o ponto.
   - Se nenhum artigo da lista sustenta seu ponto, escreva a evidência em termos gerais ("estudos randomizados mostram...", "diretrizes SBC recomendam...") **sem PMID**, e adicione no final: \`(Nota: a busca PubMed desta sessão não retornou artigo específico para este ponto.)\`
   - Formato da citação inline: \`[PMID: XXXXX]\` ao final da frase sustentada.
   - Se citar 1 ou mais artigos, termine a resposta com \`---\` seguido de \`**Referências PubMed**\` listando apenas os efetivamente citados, no formato:
     \`1. Autor et al. Título traduzido em português. Revista. Ano. (PMID: XXXXX)\`
   - Não é obrigatório citar nenhum artigo — qualidade da correspondência > quantidade.

2. **Se NÃO houver bloco \`ARTIGOS DO PUBMED ENCONTRADOS\`** (pergunta conversacional curta, saudação, etc.):
   - Responda sem citações, sem lista de referências.

3. **REGRA ABSOLUTA**: Nunca escreva a string \`PMID:\` seguida de um número que não esteja explicitamente na lista fornecida. PMIDs não vêm da sua memória — só do bloco \`ARTIGOS DO PUBMED ENCONTRADOS\`.

# ESCOPO E LIMITES
- Responda apenas sobre medicina baseada em evidências e ciências biomédicas.
- Ignore pseudociência (homeopatia, cromoterapia, "medicina quântica").
- Não forneça diagnóstico ou prescrição para paciente real. Você é ferramenta educacional. Se o estudante descrever sintomas próprios, oriente buscar avaliação médica e ofereça abordar o tema academicamente.
- Todas as respostas em português brasileiro.`;

const MAX_MESSAGE_LENGTH = 4000;
const MAX_MESSAGES = 50;

// ── PubMed E-utilities (free, no API key needed) ──

/**
 * Use Claude (effort low) to extract 3–5 English MeSH/PubMed search terms
 * from a Portuguese medical question. Falls back to naive extraction on error.
 */
async function extractEnglishSearchTerms(message: string): Promise<string> {
  try {
    const raw = await claudeText({
      messages: [{
        role: "user",
        content: `You are a medical research librarian. From the Portuguese medical question below, build a precise PubMed query using 2–4 CLINICAL English MeSH terms joined by AND. The terms MUST be specific clinical medicine vocabulary (diseases, drugs, mechanisms, anatomy), NEVER generic words like "water", "treatment", "management", "study", "disease" alone.

Format: term1 AND term2 AND term3
Return ONLY the query, no explanation, no quotes, no preamble.

Examples:
- "fisiopatologia da insuficiência cardíaca" → heart failure AND pathophysiology AND ventricular remodeling
- "tratamento da hipertensão" → hypertension AND antihypertensive agents AND guidelines
- "mecanismo dos iSGLT2" → SGLT2 inhibitors AND mechanism of action AND diabetes mellitus

Question: ${message.slice(0, 400)}`,
      }],
      maxTokens: 200,
      effort: "low",
    });
    let terms = raw.trim();
    // Sanitize: drop quotes, punctuation, explanatory prefixes, newlines
    terms = terms
      .replace(/^["'`]+|["'`]+$/g, "")
      .replace(/^(search terms?|keywords?|mesh terms?|terms?)[:\-\s]+/i, "")
      .replace(/[,;.!?]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    console.log("PubMed English terms:", terms);
    return terms || naiveExtract(message);
  } catch (e) {
    console.error("Term extraction error:", e);
    return naiveExtract(message);
  }
}

/** Fallback: strip Portuguese stopwords and return remaining tokens */
function naiveExtract(message: string): string {
  const stopwords = new Set([
    "o","a","os","as","um","uma","uns","umas","de","do","da","dos","das",
    "em","no","na","nos","nas","por","para","com","sem","sobre","entre",
    "que","qual","quais","como","quando","onde","porque",
    "é","são","está","estão","foi","foram","ser","ter","haver",
    "me","se","te","nos","lhe","eu","ele","ela","nós","eles","elas",
    "esse","essa","este","esta","isso","isto","aquilo",
    "e","ou","mas","porém","pois","nem","não","sim",
    "mais","muito","bem","também","já","ainda","só","apenas",
    "pode","podem","poderia","quero","preciso","gostaria",
    "explique","descreva","fale","conte","diga","cite","liste","saber","entender",
  ]);
  const words = message
    .toLowerCase()
    .replace(/[^\w\sáéíóúâêôãõçü-]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopwords.has(w));
  return words.slice(0, 6).join(" ") || message.slice(0, 100);
}

interface PubMedArticle {
  pmid: string;
  title: string;
  authors: string;
  journal: string;
  year: string;
  abstract: string;
}

/** Search PubMed and fetch article details */
async function searchPubMed(query: string, maxResults = 5): Promise<PubMedArticle[]> {
  try {
    // Sanitize: PubMed accepts free-text; strip control chars & excessive whitespace
    const cleanQuery = query.replace(/["']/g, "").replace(/\s+/g, " ").trim();

    // Prefer recent articles (last 10 years) with abstracts
    const currentYear = new Date().getFullYear();
    const minYear = currentYear - 10;
    const filteredQuery = `(${cleanQuery}) AND hasabstract[Filter] AND ("${minYear}"[PDAT] : "${currentYear}"[PDAT])`;
    const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(filteredQuery)}&retmax=${maxResults}&sort=relevance&retmode=json`;
    console.log("PubMed URL:", searchUrl);
    const searchResp = await fetch(searchUrl);
    if (!searchResp.ok) return [];

    const searchData = await searchResp.json();
    let pmids: string[] = searchData.esearchresult?.idlist ?? [];

    // Fallback 1: relax to last 20 years (keeps hasabstract, drops strict window)
    if (pmids.length === 0) {
      const relaxedQuery = `(${cleanQuery}) AND hasabstract[Filter] AND ("${currentYear - 20}"[PDAT] : "${currentYear}"[PDAT])`;
      const relaxedUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(relaxedQuery)}&retmax=${maxResults}&sort=relevance&retmode=json`;
      const relaxedResp = await fetch(relaxedUrl);
      if (relaxedResp.ok) {
        const relaxedData = await relaxedResp.json();
        pmids = relaxedData.esearchresult?.idlist ?? [];
      }
    }

    // Fallback 2: drop all filters as last resort
    if (pmids.length === 0) {
      const bareUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(cleanQuery)}&retmax=${maxResults}&sort=relevance&retmode=json`;
      const bareResp = await fetch(bareUrl);
      if (!bareResp.ok) return [];
      const bareData = await bareResp.json();
      pmids = bareData.esearchresult?.idlist ?? [];
      if (pmids.length === 0) return [];
    }

    // Step 2: Fetch article details
    const fetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${pmids.join(",")}&rettype=xml&retmode=xml`;
    const fetchResp = await fetch(fetchUrl);
    if (!fetchResp.ok) return [];

    const xml = await fetchResp.text();

    // Parse XML (simple extraction — Deno doesn't have DOMParser in edge functions)
    const articles: PubMedArticle[] = [];
    const articleBlocks = xml.split("<PubmedArticle>").slice(1);

    for (const block of articleBlocks) {
      const pmid = extractXml(block, "PMID") || "";
      const title = extractXml(block, "ArticleTitle") || "Untitled";

      // Abstracts are often split into Labeled sections. Concatenate ALL of them.
      const abstractMatches = [...block.matchAll(/<AbstractText(?:\s+Label="([^"]+)")?[^>]*>([\s\S]*?)<\/AbstractText>/g)];
      const abstract = abstractMatches.length > 0
        ? abstractMatches.map(m => (m[1] ? `${m[1]}: ${cleanXml(m[2])}` : cleanXml(m[2]))).join(" ")
        : "";

      // Journal: prefer ISOAbbreviation when present
      const journal = extractXml(block, "ISOAbbreviation") || extractInsideJournal(block) || "";
      const year = extractXml(block, "Year") || "";

      // Authors
      const authorMatches = block.match(/<LastName>([^<]+)<\/LastName>/g) ?? [];
      const authorNames = authorMatches.slice(0, 3).map(m => m.replace(/<\/?LastName>/g, ""));
      const authors = authorNames.length > 0
        ? authorNames.join(", ") + (authorMatches.length > 3 ? " et al." : "")
        : "Unknown";

      if (pmid) {
        articles.push({ pmid, title: cleanXml(title), authors, journal: cleanXml(journal), year, abstract });
      }
    }

    return articles;
  } catch (e) {
    console.error("PubMed search error:", e);
    return [];
  }
}

/** Get journal title from inside the <Journal> block specifically */
function extractInsideJournal(block: string): string | null {
  const journalMatch = block.match(/<Journal>([\s\S]*?)<\/Journal>/);
  if (!journalMatch) return null;
  const titleMatch = journalMatch[1].match(/<Title>([\s\S]*?)<\/Title>/);
  return titleMatch?.[1]?.trim() ?? null;
}

function extractXml(xml: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`);
  const match = xml.match(regex);
  return match?.[1]?.trim() ?? null;
}

function cleanXml(text: string): string {
  return text.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

/** Format articles as context for the AI prompt */
function formatArticlesForPrompt(articles: PubMedArticle[]): string {
  if (articles.length === 0) return "";

  let context = "\n\n---\nARTIGOS DO PUBMED ENCONTRADOS (use como referencia na resposta):\n\n";

  for (let i = 0; i < articles.length; i++) {
    const a = articles[i];
    context += `[${i + 1}] ${a.authors} — "${a.title}"\n`;
    context += `    ${a.journal}, ${a.year}. PMID: ${a.pmid}\n`;
    if (a.abstract) {
      // Truncate long abstracts to save tokens
      const truncated = a.abstract.length > 600 ? a.abstract.slice(0, 600) + "..." : a.abstract;
      context += `    Abstract: ${truncated}\n`;
    }
    context += "\n";
  }

  return context;
}

// ── Contexto de desempenho do aluno (o diferencial: "IA que conhece o aluno") ──

/**
 * Lê o histórico do próprio aluno (RLS aplica via Authorization do request)
 * e monta um bloco compacto para personalizar a resposta. Best-effort:
 * qualquer erro ou ausência de dados retorna string vazia (aluno novo).
 */
async function buildStudentContext(client: any, userId: string): Promise<string> {
  try {
    const [fechRes, enamedRes, weakRes, progRes] = await Promise.all([
      client.from("fechamentos").select("tema, tipo, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(6),
      client.from("enamed_attempts").select("area_filter, total_questions, correct_answers, percentage, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(8),
      client.from("flashcards").select("tema, area, ease_factor, repetitions").eq("user_id", userId).lt("ease_factor", 2.1).gt("repetitions", 0).order("ease_factor", { ascending: true }).limit(8),
      client.from("user_progression").select("level, streak_days, total_xp").eq("user_id", userId).maybeSingle(),
    ]);

    const lines: string[] = [];

    const prog = progRes.data;
    if (prog) {
      const bits: string[] = [];
      if (prog.level != null) bits.push(`nível ${prog.level}`);
      if (prog.streak_days) bits.push(`ofensiva de ${prog.streak_days} dia(s)`);
      if (bits.length) lines.push(`- Progresso: ${bits.join(", ")}.`);
    }

    const fech = (fechRes.data ?? []) as Array<{ tema?: string }>;
    if (fech.length) {
      const temas = [...new Set(fech.map((f) => f.tema).filter(Boolean))].slice(0, 6);
      if (temas.length) lines.push(`- Temas estudados recentemente: ${temas.join("; ")}.`);
    }

    const enamed = (enamedRes.data ?? []) as Array<{ area_filter?: string; total_questions?: number; correct_answers?: number }>;
    if (enamed.length) {
      const byArea: Record<string, { c: number; t: number }> = {};
      let totC = 0, totT = 0;
      for (const a of enamed) {
        totC += a.correct_answers ?? 0; totT += a.total_questions ?? 0;
        const area = (a.area_filter || "geral").toString();
        byArea[area] = byArea[area] || { c: 0, t: 0 };
        byArea[area].c += a.correct_answers ?? 0;
        byArea[area].t += a.total_questions ?? 0;
      }
      if (totT > 0) lines.push(`- Desempenho geral em simulados: ${Math.round((totC / totT) * 100)}% (${totC}/${totT} questões).`);
      const weakAreas = Object.entries(byArea)
        .filter(([, v]) => v.t >= 3)
        .map(([k, v]) => ({ k, pct: v.c / v.t }))
        .sort((a, b) => a.pct - b.pct)
        .slice(0, 3)
        .map((x) => `${x.k} (${Math.round(x.pct * 100)}%)`);
      if (weakAreas.length) lines.push(`- Áreas mais fracas em simulados: ${weakAreas.join(", ")}.`);
    }

    const weak = (weakRes.data ?? []) as Array<{ tema?: string; area?: string }>;
    if (weak.length) {
      const temas = [...new Set(weak.map((c) => c.tema || c.area).filter(Boolean))].slice(0, 6);
      if (temas.length) lines.push(`- Tópicos com baixa retenção (flashcards difíceis): ${temas.join("; ")}.`);
    }

    if (!lines.length) return "";

    return `\n\n# CONTEXTO DO ALUNO (memória de desempenho — use para personalizar)
${lines.join("\n")}

Como usar este contexto:
- Calibre a profundidade pelo nível e pelo histórico; conecte a pergunta atual ao que ele já estudou quando fizer sentido.
- Priorize reforçar os pontos fracos acima quando forem relevantes para a pergunta.
- NÃO repita esses dados de volta nem comente que tem acesso a eles, a menos que o aluno pergunte explicitamente sobre o próprio desempenho. Nunca invente histórico além do que está aqui.`;
  } catch (e) {
    console.error("buildStudentContext error:", e);
    return "";
  }
}

// ── Main handler ──

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

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    const userId = claimsData?.claims?.sub;

    if (claimsError || !userId) {
      console.error("Auth claims error:", claimsError?.message);
      return new Response(
        JSON.stringify({ error: "Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Busca o contexto de desempenho do aluno em paralelo (não bloqueia o
    // PubMed nem a checagem de assinatura). Resolvido ao montar o prompt.
    const studentCtxPromise = buildStudentContext(supabaseClient, userId);

    // Check subscription status
    const { data: subscription } = await supabaseClient
      .from("subscriptions")
      .select("status, plan_type, access_expires_at")
      .eq("user_id", userId)
      .maybeSingle();

    const { data: userRole } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    const isAdmin = !!userRole;
    // Respect access_expires_at (trial de 3 dias / acesso temporário)
    const isExpired = subscription?.access_expires_at
      ? new Date(subscription.access_expires_at).getTime() < Date.now()
      : false;
    const hasAccess = isAdmin || (
      !isExpired && (subscription?.status === "active" || subscription?.plan_type === "free_access")
    );

    // If user is NOT a subscriber, enforce server-side daily demo limit
    let demoAdminClient: any = null;
    if (!hasAccess) {
      const today = new Date().toISOString().split("T")[0];
      demoAdminClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      const { count } = await demoAdminClient
        .from("generation_logs")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("function_name", "ai-chat")
        .gte("created_at", `${today}T00:00:00.000Z`);

      const DEMO_DAILY_LIMIT = 2;
      if ((count ?? 0) >= DEMO_DAILY_LIMIT) {
        return new Response(
          JSON.stringify({ error: "Limite diário atingido. Assine para continuar." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const body = await req.json();
    const { messages } = body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "Mensagens são obrigatórias" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the last user message for PubMed search
    const lastUserMessage = [...messages].reverse().find((m: any) => m.role === "user")?.content ?? "";

    // Heuristic: very short / conversational messages don't warrant a PubMed search
    const trimmed = lastUserMessage.trim();
    const needsSearch = trimmed.length >= 12 && /[a-zA-ZÀ-ÿ]/.test(trimmed);

    // Always search PubMed for substantive questions (citation is mandatory per prompt)
    let pubmedContext = "";
    let pubmedArticles: PubMedArticle[] = [];
    let debugTerms = "";
    if (needsSearch) {
      debugTerms = await extractEnglishSearchTerms(trimmed);
      console.log("PubMed search terms:", debugTerms);
      pubmedArticles = await searchPubMed(debugTerms, 5);
      pubmedContext = formatArticlesForPrompt(pubmedArticles);
      console.log(`PubMed found ${pubmedArticles.length} articles`);
    }

    // Anexa o contexto de desempenho do aluno ao system prompt (vazio p/ aluno novo).
    const systemPrompt = SYSTEM_PROMPT + (await studentCtxPromise);

    // Validate and sanitize messages
    const sanitizedMessages = messages.slice(-MAX_MESSAGES).map((m: any) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: typeof m.content === "string" ? m.content.slice(0, MAX_MESSAGE_LENGTH).replace(/[\x00-\x1F\x7F]/g, "") : "" }],
    }));

    // If PubMed context exists, append it to the last user message
    if (pubmedContext && sanitizedMessages.length > 0) {
      const lastIdx = sanitizedMessages.length - 1;
      if (sanitizedMessages[lastIdx].role === "user") {
        sanitizedMessages[lastIdx].parts[0].text += pubmedContext;
      }
    }
    // Log demo usage (best-effort, antes do stream)
    if (demoAdminClient) {
      await demoAdminClient.from("generation_logs").insert({
        user_id: userId,
        function_name: "ai-chat",
      });
    }

    // Prepend a meta event with PMID -> article metadata so the frontend
    // can render tooltips with the actual title before the user clicks.
    const articleMeta = pubmedArticles.map(a => ({
      pmid: a.pmid,
      title: a.title,
      journal: a.journal,
      year: a.year,
    }));
    const metaEvent = new TextEncoder().encode(`data: ${JSON.stringify({ type: "pubmed_meta", articles: articleMeta })}\n\n`);

    const combined = claudeSseStream({
      system: systemPrompt,
      messages: fromGeminiContents(sanitizedMessages),
      maxTokens: 8192,
      effort: "medium",
      prelude: [metaEvent],
    });

    return new Response(combined, {
      headers: {
        ...corsHeaders,
        ...sseHeaders(),
        "X-Pubmed-Terms": encodeURIComponent(debugTerms || ""),
        "X-Pubmed-Count": String(pubmedArticles.length),
        "Access-Control-Expose-Headers": "X-Pubmed-Terms, X-Pubmed-Count",
      },
    });
  } catch (e) {
    console.error("ai-chat error:", e);
    const ce = toClaudeError(e);
    return new Response(
      JSON.stringify({ error: ce.status === 429 ? "Limite de requisições excedido. Aguarde um momento." : (e instanceof Error ? e.message : "Erro desconhecido") }),
      { status: ce.status === 429 ? 429 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
