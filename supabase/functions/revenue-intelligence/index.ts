// Edge Function: Revenue Intelligence
// Analisa receita/subscricoes/churn dos ultimos 3 meses e pede ao Claude
// pra resumir tendencias + prever MRR dos proximos 3 meses.
//
// Rate limit: 1 analise por admin por hora (cache em revenue_intelligence_cache).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { claudeText, toClaudeError } from "../_shared/claude.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Voce e um analista financeiro senior de SaaS educacional.
Sua tarefa: analisar os dados fornecidos e retornar insights EXECUTIVOS em PT-BR.

FORMATO OBRIGATORIO (markdown):
## Resumo executivo
2-3 frases destacando o numero mais importante do periodo.

## Tendencias identificadas
- Lista de 3-5 bullets. Cada um comeca com emoji (📈📉⚠️✅) + observacao concreta com numeros.

## Previsao MRR proximos 3 meses
Uma linha por mes: "**Mai/2026**: R$ X - justificativa em 1 frase".

## Acoes recomendadas
Lista de 2-4 acoes especificas e priorizadas por impacto.

REGRAS:
- Use numeros concretos e % de variacao quando possivel
- Nao inventar dados que nao estao no input
- Se dados insuficientes, dizer explicitamente
- Tom direto, sem floreio. Foco em decisao.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (!Deno.env.get("ANTHROPIC_API_KEY")) return json({ error: "ANTHROPIC_API_KEY nao configurado" }, 500);

    const { force = false } = await req.json().catch(() => ({}));

    // Cache simples: se ultima analise tem <1h e nao e force, retorna
    if (!force) {
      const { data: cached } = await supabase
        .from("revenue_intelligence_cache")
        .select("content, created_at")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cached && Date.now() - new Date(cached.created_at).getTime() < 60 * 60 * 1000) {
        return json({ content: cached.content, cached: true, generated_at: cached.created_at });
      }
    }

    // Coleta dados dos ultimos 3 meses
    const threeMonthsAgo = new Date(Date.now() - 90 * 86400000).toISOString();

    const [subsRes, leadsRes, inadRes, logsRes] = await Promise.all([
      supabase.from("subscriptions").select("status, plan_type, created_at, updated_at"),
      supabase.from("crm_leads").select("status, created_at, converted_at, churned_at, utm_source").gte("created_at", threeMonthsAgo),
      supabase.from("admin_inadimplencias").select("status, valor_devido, data_ocorrencia").gte("data_ocorrencia", threeMonthsAgo),
      supabase.from("generation_logs").select("user_id, created_at").gte("created_at", threeMonthsAgo).limit(10000),
    ]);

    const subs = subsRes.data ?? [];
    const leads = leadsRes.data ?? [];
    const inad = inadRes.data ?? [];
    const logs = logsRes.data ?? [];

    // Agrega em summary compacto (nao manda o dataset cru pro Claude)
    const mrr = subs.filter((s: any) => s.status === "active").reduce((sum: number, s: any) => {
      if (s.plan_type === "monthly") return sum + 49.90;
      if (s.plan_type === "annual") return sum + 350.90 / 12;
      if (s.plan_type === "biannual") return sum + 599.90 / 6;
      return sum;
    }, 0);

    const activeSubs = subs.filter((s: any) => s.status === "active").length;
    const churned = subs.filter((s: any) => s.status === "inactive").length;
    const inadimplentes = subs.filter((s: any) => s.status === "inadimplente").length;
    const byPlan = subs.reduce((acc: Record<string, number>, s: any) => {
      if (s.status === "active") acc[s.plan_type] = (acc[s.plan_type] ?? 0) + 1;
      return acc;
    }, {});

    const leadsByStatus = leads.reduce((acc: Record<string, number>, l: any) => {
      acc[l.status] = (acc[l.status] ?? 0) + 1;
      return acc;
    }, {});
    const conversions = leads.filter((l: any) => l.converted_at).length;
    const conversionRate = leads.length > 0 ? (conversions / leads.length) * 100 : 0;

    const churnedRecent = leads.filter((l: any) => l.churned_at).length;

    const totalDevido = inad.filter((i: any) => i.status === "em_cobranca").reduce((s: number, i: any) => s + Number(i.valor_devido ?? 0), 0);
    const recuperados = inad.filter((i: any) => i.status === "resolvido").length;

    const topSources = Object.entries(leads.reduce((acc: Record<string, number>, l: any) => {
      const src = l.utm_source || "direct";
      acc[src] = (acc[src] ?? 0) + 1;
      return acc;
    }, {})).sort((a: any, b: any) => b[1] - a[1]).slice(0, 5);

    // Agrupa atividade por mes
    const activityByMonth: Record<string, number> = {};
    const uniqueUsersByMonth: Record<string, Set<string>> = {};
    for (const l of logs) {
      const mo = l.created_at.slice(0, 7); // YYYY-MM
      activityByMonth[mo] = (activityByMonth[mo] ?? 0) + 1;
      if (!uniqueUsersByMonth[mo]) uniqueUsersByMonth[mo] = new Set();
      uniqueUsersByMonth[mo].add(l.user_id);
    }
    const mau = Object.fromEntries(Object.entries(uniqueUsersByMonth).map(([k, v]) => [k, v.size]));

    const summary = {
      periodo: "ultimos 90 dias",
      assinaturas: {
        ativas_total: activeSubs,
        por_plano: byPlan,
        canceladas: churned,
        inadimplentes,
        mrr_atual_reais: Math.round(mrr * 100) / 100,
      },
      leads: {
        total_novos: leads.length,
        por_status: leadsByStatus,
        conversoes: conversions,
        taxa_conversao_pct: Math.round(conversionRate * 10) / 10,
        churned: churnedRecent,
        top_5_utm_sources: topSources,
      },
      inadimplencia: {
        valor_em_aberto_reais: Math.round(totalDevido * 100) / 100,
        recuperados_total: recuperados,
      },
      engajamento: {
        geracoes_por_mes: activityByMonth,
        usuarios_ativos_por_mes: mau,
        total_geracoes_90d: logs.length,
      },
    };

    // Chama Claude
    let content: string;
    try {
      content = await claudeText({
        system: SYSTEM_PROMPT,
        messages: [{
          role: "user",
          content: `Analise estes dados e gere o relatorio seguindo o formato especificado:\n\n\`\`\`json\n${JSON.stringify(summary, null, 2)}\n\`\`\``,
        }],
        maxTokens: 2000,
        effort: "medium",
      });
    } catch (e) {
      const ce = toClaudeError(e);
      console.error("[revenue-intelligence] Claude error:", ce.status, ce.message);
      return json({ error: `Claude API falhou: ${ce.status}` }, 500);
    }
    if (!content) content = "(resposta vazia do modelo)";

    // Salva no cache
    await supabase.from("revenue_intelligence_cache").insert({
      content,
      data_snapshot: summary,
    });

    return json({ content, cached: false, generated_at: new Date().toISOString() });
  } catch (err) {
    console.error("[revenue-intelligence] Error:", (err as Error).message);
    return json({ error: (err as Error).message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
