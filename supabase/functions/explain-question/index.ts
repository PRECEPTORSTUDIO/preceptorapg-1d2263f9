// Edge Function: Explain Question
// Recebe um questao_id de prova_questoes_importadas e retorna uma explicacao
// academica gerada por IA (Claude). Cacheia o resultado em justificativa
// (origem='ia') pra proxima vez.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { claudeText, toClaudeError } from "../_shared/claude.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const RATE_LIMIT_PER_HOUR = 60; // 60 explicacoes/hora por user (admin sem limite)

interface RequestBody {
  questao_id?: string;
  /** Se true e ja existe justificativa, regenera mesmo assim. Default false. */
  force_regenerate?: boolean;
}

async function callClaude(systemPrompt: string, userPrompt: string): Promise<string> {
  const text = await claudeText({
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
    maxTokens: 4096,
    effort: "medium",
  });
  return text.trim();
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
  const { data: { user }, error: authError } = await userClient.auth.getUser(token);
  const userId = user?.id;
  if (authError || !userId) {
    console.error("explain-question auth error:", authError?.message);
    return new Response(JSON.stringify({ error: "Token invalido" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  // Subscription check
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
  const questaoId = body.questao_id;
  if (!questaoId) {
    return new Response(JSON.stringify({ error: "questao_id obrigatorio" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Carrega questao + valida ownership
  const { data: questao, error: qError } = await adminClient
    .from("prova_questoes_importadas")
    .select("*")
    .eq("id", questaoId)
    .eq("user_id", userId)
    .maybeSingle();
  if (qError || !questao) {
    return new Response(
      JSON.stringify({ error: "Questao nao encontrada ou nao pertence ao user" }),
      {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // Cache: se ja tem justificativa e nao foi pedido regen, devolve direto
  if (
    !body.force_regenerate &&
    questao.justificativa &&
    questao.justificativa.trim().length > 50
  ) {
    return new Response(
      JSON.stringify({
        success: true,
        cached: true,
        justificativa: questao.justificativa,
        origem: questao.justificativa_origem,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Rate limit (apenas em modo regenerar pra evitar abuso)
  if (!isAdmin) {
    const hourAgo = new Date(Date.now() - 3600 * 1000).toISOString();
    const { count } = await adminClient
      .from("generation_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("function_name", "explain-question")
      .gte("created_at", hourAgo);
    if ((count ?? 0) >= RATE_LIMIT_PER_HOUR) {
      return new Response(
        JSON.stringify({
          error: `Limite de ${RATE_LIMIT_PER_HOUR} explicacoes IA por hora atingido. Aguarde.`,
        }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
  }

  // Build prompt
  if (!Deno.env.get("ANTHROPIC_API_KEY")) {
    return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY nao configurada" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const altLetters = (questao.alternativas as string[]).map(
    (alt, i) => `${String.fromCharCode(65 + i)}) ${alt}`,
  ).join("\n");

  const systemPrompt = `Voce e um Preceptor Academico de Medicina. Sua tarefa e justificar com rigor cientifico e linguagem clinica precisa qual a alternativa correta de uma questao e por que cada uma das outras esta errada. Use mecanismos fisiopatologicos, niveis de evidencia, dados epidemiologicos brasileiros (DATASUS/SUS/diretrizes brasileiras quando relevante). NAO invente referencias com pagina/capitulo. Se houver controversia na literatura, sinalize. Cite livros/diretrizes apenas pelo nome (ex: Harrison, Diretriz SBC 2024).`;

  const userPrompt = `Questao de prova de medicina:

${questao.enunciado}

${altLetters}

Gabarito oficial: ${questao.gabarito}

Produza uma justificativa estruturada em ate 5 paragrafos densos:

1. **Conceito-chave** que a questao testa (1 paragrafo)
2. **Por que a alternativa ${questao.gabarito} esta correta** (mecanismo + evidencia)
3. **Por que cada uma das outras esta errada** (analise alternativa por alternativa)
4. **Pegadinhas / pearls** se houver (opcional)
5. **Resumo de conduta** ou regra-mnemonica para fixar (opcional)

Use markdown limitado: **negrito** em termos chave. NAO use cabecalhos com #. Comece direto pelo conteudo, sem introducao do tipo "Vamos analisar...".`;

  // Log da chamada (pra rate limit + health score)
  void adminClient.from("generation_logs").insert({
    user_id: userId,
    function_name: "explain-question",
  });

  let justificativa: string;
  try {
    justificativa = await callClaude(systemPrompt, userPrompt);
    if (!justificativa || justificativa.length < 30) {
      throw new Error("Resposta da IA muito curta ou vazia");
    }
  } catch (err) {
    const ce = toClaudeError(err);
    return new Response(
      JSON.stringify({ error: ce.message ?? "Falha ao gerar explicacao" }),
      {
        status: ce.status === 429 ? 429 : 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // Persiste no DB
  await adminClient
    .from("prova_questoes_importadas")
    .update({
      justificativa,
      justificativa_origem: "ia",
    })
    .eq("id", questaoId);

  return new Response(
    JSON.stringify({
      success: true,
      cached: false,
      justificativa,
      origem: "ia",
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
