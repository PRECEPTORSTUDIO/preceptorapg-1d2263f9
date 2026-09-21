// Edge Function: wb-ask-ai
// Chat conversacional contextualizado sobre conteudo do Whitebook.
//
// Modos:
// - scoped (scope_type + scope_id passados): contexto restrito ao item especifico.
//   Sistema de prompt diz pra IA responder APENAS sobre aquele item.
// - global (sem scope): faz retrieval full-text em wb_drugs/protocols/calculators/icd10
//   e usa top resultados como contexto (RAG simples).
//
// Output: streaming SSE compativel com o padrao OpenAI (mesmo que ai-chat).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { claudeSseStream, fromGeminiContents, sseHeaders } from "../_shared/claude.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const RATE_LIMIT_PER_HOUR = 60;

interface RequestBody {
  query: string;
  scope_type?: "drug" | "protocol" | "calculator" | "icd";
  scope_id?: string;  // slug pra drug/protocol/calculator; code pra icd
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}

// ────────────────────────────────────────────────────────────
// Prompt builder
// ────────────────────────────────────────────────────────────
function buildSystemPrompt(scopedContext: string | null): string {
  const base = `Voce e o assistente clinico do Whitebook PreceptorMED. Responde duvidas
de medicos, residentes e estudantes em ciclo clinico/internato sobre
medicamentos, protocolos, calculadoras e CID-10.

REGRAS:
1. Use APENAS as informacoes do contexto fornecido. Se a resposta nao
   estiver no contexto, diga "Esta informacao nao esta no Whitebook —
   consulte a fonte primaria."
2. NAO invente posologias, contraindicacoes ou interacoes.
3. Linguagem: portugues brasileiro tecnico-clinico, sem floreios. Direto.
4. Cite o item de origem entre parenteses no fim de cada afirmacao quando
   relevante (ex: "(Whitebook · Amoxicilina)").
5. Para perguntas fora do escopo do Whitebook: redirecione gentilmente.
6. SEMPRE termine com lembrete: "Confirme com a bula/diretriz antes de
   prescrever." se a resposta envolver droga ou conduta.
7. NUNCA reproduza grandes blocos de texto literal — sintetize.`;

  if (scopedContext) {
    return base + `\n\nCONTEXTO ESPECIFICO (responda APENAS sobre este item):\n\n${scopedContext}`;
  }
  return base;
}

async function buildScopedContext(
  adminClient: ReturnType<typeof createClient>,
  scopeType: string,
  scopeId: string,
): Promise<string | null> {
  if (scopeType === "drug") {
    const { data } = await adminClient
      .from("wb_drugs")
      .select("nome_principio, classe_terapeutica, nome_comercial, apresentacoes, dose_adulto, dose_pediatrica, dose_idoso, ajuste_renal, ajuste_hepatico, gestacao_categoria, gestacao_obs, lactacao, interacoes, contraindicacoes, efeitos_adversos, alertas_seguranca, monitoramento")
      .eq("slug", scopeId)
      .eq("published", true)
      .maybeSingle();
    if (!data) return null;
    return `=== DROGA: ${data.nome_principio} ===\n${JSON.stringify(data, null, 2)}`;
  }
  if (scopeType === "protocol") {
    const { data } = await adminClient
      .from("wb_protocols")
      .select("titulo, categoria, nivel_atencao, resumo, criterios_diagnosticos, conduta_passos, exames_solicitar, red_flags, fonte")
      .eq("slug", scopeId)
      .eq("published", true)
      .maybeSingle();
    if (!data) return null;
    return `=== PROTOCOLO: ${data.titulo} (${data.categoria}) ===\n${JSON.stringify(data, null, 2)}`;
  }
  if (scopeType === "calculator") {
    const { data } = await adminClient
      .from("wb_calculators")
      .select("nome, categoria, descricao, quando_usar, definicao, fonte")
      .eq("slug", scopeId)
      .eq("published", true)
      .maybeSingle();
    if (!data) return null;
    return `=== CALCULADORA: ${data.nome} (${data.categoria}) ===\n${JSON.stringify(data, null, 2)}`;
  }
  if (scopeType === "icd") {
    const { data } = await adminClient
      .from("wb_icd10")
      .select("code, descricao_pt, capitulo, capitulo_titulo")
      .eq("code", scopeId)
      .maybeSingle();
    if (!data) return null;
    return `=== CID-10: ${data.code} — ${data.descricao_pt} (Cap. ${data.capitulo}: ${data.capitulo_titulo}) ===`;
  }
  return null;
}

async function buildGlobalContext(
  adminClient: ReturnType<typeof createClient>,
  query: string,
): Promise<string> {
  // Retrieval full-text simples — pega top 3 de cada tipo
  const ilike = `%${query}%`;
  const [drugsRes, protocolsRes, calcsRes, icdRes] = await Promise.all([
    adminClient
      .from("wb_drugs")
      .select("nome_principio, classe_terapeutica, dose_adulto, contraindicacoes")
      .eq("published", true)
      .or(`nome_principio.ilike.${ilike},classe_terapeutica.ilike.${ilike}`)
      .limit(3),
    adminClient
      .from("wb_protocols")
      .select("titulo, categoria, resumo, conduta_passos, red_flags")
      .eq("published", true)
      .or(`titulo.ilike.${ilike},resumo.ilike.${ilike}`)
      .limit(3),
    adminClient
      .from("wb_calculators")
      .select("nome, categoria, descricao, quando_usar, definicao")
      .eq("published", true)
      .or(`nome.ilike.${ilike},descricao.ilike.${ilike},quando_usar.ilike.${ilike}`)
      .limit(3),
    adminClient
      .from("wb_icd10")
      .select("code, descricao_pt, capitulo_titulo")
      .or(`code.ilike.${query.toUpperCase()}%,descricao_pt.ilike.${ilike}`)
      .limit(5),
  ]);

  const sections: string[] = [];
  if (drugsRes.data && drugsRes.data.length > 0) {
    sections.push("=== DROGAS RELEVANTES ===\n" + JSON.stringify(drugsRes.data, null, 2));
  }
  if (protocolsRes.data && protocolsRes.data.length > 0) {
    sections.push("=== PROTOCOLOS RELEVANTES ===\n" + JSON.stringify(protocolsRes.data, null, 2));
  }
  if (calcsRes.data && calcsRes.data.length > 0) {
    sections.push("=== CALCULADORAS RELEVANTES ===\n" + JSON.stringify(calcsRes.data, null, 2));
  }
  if (icdRes.data && icdRes.data.length > 0) {
    sections.push("=== CIDs RELEVANTES ===\n" + JSON.stringify(icdRes.data, null, 2));
  }

  if (sections.length === 0) {
    return "Nenhum item relevante encontrado no Whitebook para esta busca.";
  }
  return sections.join("\n\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth
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
  const { data: claimsData } = await userClient.auth.getClaims(token);
  const userId = claimsData?.claims?.sub;
  if (!userId) {
    return new Response(JSON.stringify({ error: "Token invalido" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  // Subscription
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
  const hasAccess = !isExpired && (
    subscription?.status === "active" || subscription?.plan_type === "free_access"
  );
  if (!hasAccess && !isAdmin) {
    return new Response(JSON.stringify({ error: "Assinatura ativa necessaria" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Body
  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON invalido" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!body.query || typeof body.query !== "string" || body.query.trim().length < 3) {
    return new Response(JSON.stringify({ error: "Pergunta muito curta" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Rate limit
  if (!isAdmin) {
    const hourAgo = new Date(Date.now() - 3600 * 1000).toISOString();
    const { count } = await adminClient
      .from("generation_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("function_name", "wb-ask-ai")
      .gte("created_at", hourAgo);
    if ((count ?? 0) >= RATE_LIMIT_PER_HOUR) {
      return new Response(
        JSON.stringify({
          error: `Limite de ${RATE_LIMIT_PER_HOUR} perguntas/hora atingido.`,
        }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
  }

  // Build context
  let context: string | null = null;
  if (body.scope_type && body.scope_id) {
    context = await buildScopedContext(adminClient, body.scope_type, body.scope_id);
    if (!context) {
      return new Response(
        JSON.stringify({ error: "Item nao encontrado no Whitebook" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
  } else {
    context = await buildGlobalContext(adminClient, body.query);
  }

  if (!Deno.env.get("ANTHROPIC_API_KEY")) {
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY nao configurada" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // Log da chamada (rate limit + analytics)
  void adminClient.from("generation_logs").insert({
    user_id: userId,
    function_name: "wb-ask-ai",
  });
  if (!body.scope_type) {
    // Tambem loga em wb_search_logs pra analytics
    void adminClient.from("wb_search_logs").insert({
      user_id: userId,
      query: body.query.slice(0, 200),
    });
  }

  const systemPrompt = buildSystemPrompt(context);

  // Constroi historico se houver
  const contents = [];
  for (const msg of body.history ?? []) {
    contents.push({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    });
  }
  contents.push({ role: "user", parts: [{ text: body.query }] });

  const stream = claudeSseStream({
    system: systemPrompt,
    messages: fromGeminiContents(contents),
    maxTokens: 4096,
    effort: "medium",
  });

  return new Response(stream, {
    headers: { ...corsHeaders, ...sseHeaders() },
  });
});
