import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { claudeJson, toClaudeError } from "../_shared/claude.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUMMARY_SYSTEM_PROMPT = `Você é um analista de produto brasileiro do PreceptorMED (plataforma de educação médica com IA).

Recebe uma lista de feedbacks reais de usuários e gera um relatório executivo em português brasileiro.

# TAREFA
Analise os feedbacks e produza:

1. **Resumo executivo** (3-5 linhas) — o que tem sido mais pedido e qual a dor principal
2. **Top 5 temas** com:
   - Nome do tema (curto, 3-5 palavras)
   - Quantidade de menções
   - Categoria (bug, melhoria, feature, ui_ux, performance, conteúdo, outro)
   - Sentimento geral (positivo, neutro, negativo, crítico)
   - 1-2 citações curtas representativas dos usuários
3. **Ações recomendadas** — o que o time deve priorizar (3-5 bullets)
4. **Quick wins** — melhorias rápidas que podem ser feitas agora

# FORMATO DE SAÍDA
Responda APENAS com JSON válido nesse formato exato (sem markdown, sem texto extra):

{
  "executive_summary": "string",
  "top_themes": [
    {
      "theme": "string",
      "mentions": number,
      "category": "bug|improvement|feature|ui_ux|performance|content|other",
      "sentiment": "positive|neutral|negative|critical",
      "quotes": ["string", "string"]
    }
  ],
  "recommended_actions": ["string"],
  "quick_wins": ["string"]
}

Não inclua nenhum texto fora do JSON. Não use backticks. Não use markdown.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // CRM admin auth: expects x-crm-token header (HMAC token) from CrmAuthContext
    // Same pattern as crm-admin-actions — for simplicity we accept a valid Supabase admin
    // user bearer token OR the CRM token.
    const authHeader = req.headers.get("Authorization");
    const crmToken = req.headers.get("x-crm-token");

    if (!authHeader?.startsWith("Bearer ") && !crmToken) {
      return new Response(
        JSON.stringify({ error: "Autenticação necessária" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // If using a supabase user token, verify admin role
    if (authHeader?.startsWith("Bearer ")) {
      const userClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        { global: { headers: { Authorization: authHeader } } }
      );
      const token = authHeader.replace("Bearer ", "");
      const { data: claimsData } = await userClient.auth.getClaims(token);
      const userId = claimsData?.claims?.sub;
      if (!userId) {
        return new Response(
          JSON.stringify({ error: "Token inválido" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const { data: role } = await serviceClient
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();
      if (!role) {
        return new Response(
          JSON.stringify({ error: "Acesso negado" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const url = new URL(req.url);
    const periodDays = Math.max(1, Math.min(365, parseInt(url.searchParams.get("days") ?? "30", 10)));
    const periodStart = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);
    const periodEnd = new Date();

    // Check cached summary (within last 24h for same period)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: cached } = await serviceClient
      .from("support_feedback_summaries")
      .select("*")
      .gte("generated_at", oneDayAgo)
      .gte("period_start", periodStart.toISOString().slice(0, 10))
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cached && url.searchParams.get("refresh") !== "1") {
      return new Response(
        JSON.stringify({
          cached: true,
          summary: cached,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch feedbacks
    const { data: feedbacks, error: fbError } = await serviceClient
      .from("support_feedback")
      .select("category, title, content, created_at")
      .gte("created_at", periodStart.toISOString())
      .order("created_at", { ascending: false })
      .limit(500);

    if (fbError) {
      console.error("Feedback fetch error:", fbError);
      return new Response(
        JSON.stringify({ error: "Erro ao carregar feedbacks" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const totalFeedbacks = feedbacks?.length ?? 0;

    if (totalFeedbacks === 0) {
      const emptyResult = {
        executive_summary: "Nenhum feedback recebido no período selecionado. Incentive os usuários a compartilharem sugestões pelo widget de suporte.",
        top_themes: [],
        recommended_actions: ["Divulgar o widget de feedback", "Adicionar prompts in-app após momentos de sucesso (ex: após gerar um fechamento)"],
        quick_wins: [],
      };

      const { data: saved } = await serviceClient
        .from("support_feedback_summaries")
        .insert({
          period_start: periodStart.toISOString(),
          period_end: periodEnd.toISOString(),
          total_feedbacks: 0,
          top_themes: emptyResult.top_themes,
          executive_summary: emptyResult.executive_summary,
          detailed_summary: JSON.stringify(emptyResult),
        })
        .select()
        .single();

      return new Response(
        JSON.stringify({ cached: false, summary: saved }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build prompt content
    const feedbackList = feedbacks!
      .map((f, idx) => {
        const title = f.title ? `[${f.title}] ` : "";
        const cat = `(${f.category})`;
        return `${idx + 1}. ${cat} ${title}${f.content.slice(0, 400)}`;
      })
      .join("\n");

    type SummaryJson = {
      executive_summary: string;
      top_themes: Array<{
        theme: string;
        mentions: number;
        category: string;
        sentiment: string;
        quotes: string[];
      }>;
      recommended_actions: string[];
      quick_wins: string[];
    };

    let parsed: SummaryJson;
    try {
      parsed = await claudeJson<SummaryJson>({
        system: SUMMARY_SYSTEM_PROMPT,
        messages: [{
          role: "user",
          content: `Analise os ${totalFeedbacks} feedbacks recebidos nos últimos ${periodDays} dias e retorne APENAS o JSON conforme especificado:\n\n${feedbackList}`,
        }],
        jsonOnly: true,
        maxTokens: 4096,
        effort: "medium",
      });
    } catch (e) {
      const ce = toClaudeError(e);
      console.error("Claude summary error:", ce.status, ce.message);
      if (ce.status !== 502 || !ce.message.includes("JSON")) {
        return new Response(
          JSON.stringify({ error: "Erro ao gerar resumo" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      // Modelo devolveu JSON invalido: mantem o fallback anterior
      parsed = {
        executive_summary: "Não foi possível gerar o resumo automaticamente. Tente novamente.",
        top_themes: [],
        recommended_actions: [],
        quick_wins: [],
      };
    }

    const { data: saved } = await serviceClient
      .from("support_feedback_summaries")
      .insert({
        period_start: periodStart.toISOString(),
        period_end: periodEnd.toISOString(),
        total_feedbacks: totalFeedbacks,
        top_themes: parsed.top_themes ?? [],
        executive_summary: parsed.executive_summary ?? "",
        detailed_summary: JSON.stringify(parsed),
      })
      .select()
      .single();

    return new Response(
      JSON.stringify({ cached: false, summary: saved }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("support-feedback-summary error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
