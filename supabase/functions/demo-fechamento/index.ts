// Edge Function: demo-fechamento (PÚBLICA, sem auth)
// "Experimente sem cadastro": gera um mini-fechamento real a partir de um tema.
// Protegida por rate-limit (2/IP/24h) + cap global diário (custo limitado).
// Objetivo: provar valor pro tráfego frio antes de pedir cadastro.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { claudeText, toClaudeError } from "../_shared/claude.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_PER_IP_24H = 2;
const GLOBAL_DAILY_CAP = 400;

const SYS = `Você é um Preceptor de Medicina experiente. Gere um MINI-FECHAMENTO objetivo e correto sobre o tema, para um estudante de medicina brasileiro. Regras:
- NUNCA invente números, doses, valores de referência ou referências. Se incerto, omita ou use "aproximadamente".
- Use terminologia médica correta (ex: "dispneia", não "falta de ar").
- Markdown limpo. Conteúdo CURTO e de alto rendimento (~350-450 palavras no total).
- Estrutura sugerida (adapte se o tema for focado, ex: um exame ou fármaco): ## Definição · ## Fisiopatologia (cascata curta em texto) · ## Quadro clínico · ## Diagnóstico · ## Tratamento de 1ª linha.
- Apenas TEXTO e listas. NÃO use diagramas, mermaid, nem blocos de código.
- Vá direto ao conteúdo — não escreva introduções do tipo "neste resumo...".`;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const temaRaw = typeof body?.tema === "string" ? body.tema : "";
    const tema = temaRaw.trim().replace(/[\x00-\x1F\x7F]/g, "").slice(0, 120);
    if (tema.length < 3) return json({ error: "tema", message: "Digite um tema (ex: Insuficiência cardíaca)." }, 400);

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";

    // Rate-limit por IP (24h)
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { count: ipCount } = await sb.from("demo_generations")
      .select("id", { count: "exact", head: true })
      .eq("ip", ip).gte("created_at", since);
    if ((ipCount ?? 0) >= MAX_PER_IP_24H) {
      return json({ error: "limit", message: "Você já gerou seus exemplos grátis de hoje. Crie uma conta grátis pra gerar ilimitado e salvar." }, 429);
    }

    // Cap global diário (limita custo / abuso)
    const todayStart = new Date(); todayStart.setUTCHours(0, 0, 0, 0);
    const { count: globalCount } = await sb.from("demo_generations")
      .select("id", { count: "exact", head: true })
      .gte("created_at", todayStart.toISOString());
    if ((globalCount ?? 0) >= GLOBAL_DAILY_CAP) {
      return json({ error: "busy", message: "O modo demonstração atingiu o limite de hoje. Crie sua conta grátis pra gerar agora mesmo." }, 429);
    }

    if (!Deno.env.get("ANTHROPIC_API_KEY")) return json({ error: "config", message: "Serviço indisponível no momento." }, 500);

    let markdown = "";
    try {
      markdown = await claudeText({
        system: SYS,
        messages: [{ role: "user", content: `Tema: ${tema}\n\nGere o mini-fechamento.` }],
        maxTokens: 2200,
        effort: "medium",
      });
    } catch (e) {
      console.error("demo-fechamento IA error:", toClaudeError(e).message);
      return json({ error: "ai", message: "Não consegui gerar agora. Tente de novo em instantes." }, 502);
    }
    if (!markdown.trim()) {
      return json({ error: "empty", message: "Não consegui gerar agora. Tente um tema mais específico." }, 502);
    }

    // Registra a geração (rate-limit + analytics). Best-effort.
    sb.from("demo_generations").insert({ ip, tema }).then(() => {}, () => {});

    return json({ markdown, tema });
  } catch (e) {
    return json({ error: "server", message: (e as Error).message }, 500);
  }
});
