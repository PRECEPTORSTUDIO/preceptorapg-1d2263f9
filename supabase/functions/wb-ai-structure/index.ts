// Edge Function: wb-ai-structure
// Recebe texto bruto (bula ANVISA, diretriz, etc) e modo ('drug' ou 'protocol').
// Manda pro Claude com schema rigido pra estruturar em JSON
// padrao do Whitebook. Salva em wb_drugs ou wb_protocols com published=false
// (rascunho — admin revisa antes de publicar).
//
// Apenas admin pode chamar (verificacao via has_role).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { claudeJson, toClaudeError } from "../_shared/claude.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  mode: "drug" | "protocol";
  raw_text: string;
  fonte_url?: string;
  fonte?: string;
  // Opcional: se passar slug existente, faz UPDATE (re-estruturar) em vez de INSERT
  existing_slug?: string;
}

// ────────────────────────────────────────────────────────────
// Prompts especializados
// ────────────────────────────────────────────────────────────
const DRUG_SYSTEM_PROMPT = `Voce eh um curador medico do Whitebook PreceptorMED.
Sua tarefa: extrair informacao estruturada de uma fonte publica brasileira
(bula ANVISA, monografia farmacopeica, diretriz) e devolver JSON conforme
o schema fornecido.

REGRAS:
1. SINTETIZE com palavras proprias — nao copie literal trechos longos.
2. Se algum campo nao estiver no texto-fonte, devolva null/array vazio.
3. Doses: separe adulto/pediatrico/idoso/ajuste renal/ajuste hepatico.
4. Categorias FDA de gestacao: 'A','B','C','D','X' (legacy mas ainda usado).
5. Fonte deve ser citada por nome (ex: 'Bula ANVISA', 'Diretriz SBC 2024').
6. NAO invente posologias se nao estiverem no texto. Use 'A definir' quando ausente.
7. Linguagem: portugues brasileiro tecnico, sem floreios.`;

const PROTOCOL_SYSTEM_PROMPT = `Voce eh um curador medico do Whitebook PreceptorMED.
Sua tarefa: extrair conduta clinica estruturada de uma diretriz brasileira
publica (SBC, SBP, SBI, Febrasgo, MS-PCDT, etc) e devolver JSON.

REGRAS:
1. SINTETIZE com palavras proprias — nao reproduza trechos longos.
2. Conduta_passos eh sequencial (ordem 1, 2, 3...). Cada passo: acao + detalhe.
3. Red_flags = sinais de gravidade que mudam conduta (ex: choque, alteracao mental).
4. Cite a fonte por nome + ano (ex: 'Diretriz Brasileira de Sepse 2023').
5. Ortografia: portugues brasileiro tecnico-clinico.`;

const DRUG_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    nome_principio: { type: "STRING" },
    nome_comercial: { type: "ARRAY", items: { type: "STRING" } },
    classe_terapeutica: { type: "STRING" },
    via_administracao: { type: "ARRAY", items: { type: "STRING" } },
    apresentacoes: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          forma: { type: "STRING" },
          concentracao: { type: "STRING" },
        },
      },
    },
    dose_adulto: {
      type: "OBJECT",
      properties: {
        padrao: { type: "STRING" },
        max_diaria: { type: "STRING" },
      },
    },
    dose_pediatrica: {
      type: "OBJECT",
      properties: {
        mg_kg_dia: { type: "STRING" },
        max: { type: "STRING" },
        observacoes: { type: "STRING" },
      },
    },
    dose_idoso: {
      type: "OBJECT",
      properties: {
        observacoes: { type: "STRING" },
      },
    },
    ajuste_renal: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          condicao: { type: "STRING" },
          ajuste: { type: "STRING" },
        },
      },
    },
    ajuste_hepatico: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          condicao: { type: "STRING" },
          ajuste: { type: "STRING" },
        },
      },
    },
    gestacao_categoria: { type: "STRING" },
    gestacao_obs: { type: "STRING" },
    lactacao: { type: "STRING" },
    interacoes: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          droga: { type: "STRING" },
          severidade: { type: "STRING" },
          mecanismo: { type: "STRING" },
        },
      },
    },
    contraindicacoes: { type: "ARRAY", items: { type: "STRING" } },
    efeitos_adversos: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          categoria: { type: "STRING" },
          lista: { type: "ARRAY", items: { type: "STRING" } },
        },
      },
    },
    alertas_seguranca: { type: "ARRAY", items: { type: "STRING" } },
    monitoramento: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["nome_principio", "classe_terapeutica"],
};

const PROTOCOL_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    titulo: { type: "STRING" },
    categoria: { type: "STRING" },
    nivel_atencao: { type: "STRING" },
    resumo: { type: "STRING" },
    criterios_diagnosticos: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          item: { type: "STRING" },
          detalhe: { type: "STRING" },
        },
      },
    },
    conduta_passos: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          ordem: { type: "INTEGER" },
          acao: { type: "STRING" },
          detalhe: { type: "STRING" },
        },
      },
    },
    exames_solicitar: { type: "ARRAY", items: { type: "STRING" } },
    red_flags: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["titulo", "categoria"],
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 80);
}

async function callClaudeStructured(
  systemPrompt: string,
  userText: string,
  schema: unknown,
): Promise<Record<string, unknown>> {
  try {
    return await claudeJson<Record<string, unknown>>({
      system: systemPrompt,
      messages: [{ role: "user", content: userText }],
      jsonSchema: schema as Record<string, unknown>,
      maxTokens: 8192,
      effort: "medium",
    });
  } catch (e) {
    const ce = toClaudeError(e);
    throw new Error(`IA ${ce.status}: ${ce.message.slice(0, 300)}`);
  }
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

  // Apenas admin pode estruturar conteudo
  const { data: role } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!role) {
    return new Response(
      JSON.stringify({ error: "Apenas admin pode usar este endpoint" }),
      {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
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

  if (
    !body.mode ||
    !["drug", "protocol"].includes(body.mode) ||
    !body.raw_text ||
    body.raw_text.trim().length < 100
  ) {
    return new Response(
      JSON.stringify({
        error: "mode ('drug'|'protocol') e raw_text (>=100 chars) obrigatorios",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // Log da chamada
  void adminClient.from("generation_logs").insert({
    user_id: userId,
    function_name: "wb-ai-structure",
  });

  try {
    if (body.mode === "drug") {
      const data = await callClaudeStructured(
        DRUG_SYSTEM_PROMPT,
        body.raw_text,
        DRUG_RESPONSE_SCHEMA,
      );

      const slug = body.existing_slug ?? slugify(String(data.nome_principio ?? "droga"));
      if (!slug) throw new Error("nome_principio nao detectado");

      const row = {
        slug,
        nome_principio: String(data.nome_principio ?? ""),
        nome_comercial: (data.nome_comercial ?? []) as string[],
        classe_terapeutica: (data.classe_terapeutica as string) ?? null,
        via_administracao: (data.via_administracao ?? []) as string[],
        apresentacoes: data.apresentacoes ?? [],
        dose_adulto: data.dose_adulto ?? {},
        dose_pediatrica: data.dose_pediatrica ?? {},
        dose_idoso: data.dose_idoso ?? {},
        ajuste_renal: data.ajuste_renal ?? [],
        ajuste_hepatico: data.ajuste_hepatico ?? [],
        gestacao_categoria: (data.gestacao_categoria as string) ?? null,
        gestacao_obs: (data.gestacao_obs as string) ?? null,
        lactacao: (data.lactacao as string) ?? null,
        interacoes: data.interacoes ?? [],
        contraindicacoes: (data.contraindicacoes ?? []) as string[],
        efeitos_adversos: data.efeitos_adversos ?? [],
        alertas_seguranca: (data.alertas_seguranca ?? []) as string[],
        monitoramento: (data.monitoramento ?? []) as string[],
        bula_fonte_url: body.fonte_url ?? null,
        published: false,
        raw_extraction: data,
      };

      const { data: inserted, error } = await adminClient
        .from("wb_drugs")
        .upsert(row, { onConflict: "slug" })
        .select("id, slug")
        .single();
      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, mode: "drug", id: inserted.id, slug: inserted.slug }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // mode === 'protocol'
    const data = await callClaudeStructured(
      PROTOCOL_SYSTEM_PROMPT,
      body.raw_text,
      PROTOCOL_RESPONSE_SCHEMA,
    );

    const slug = body.existing_slug ?? slugify(String(data.titulo ?? "protocolo"));
    if (!slug) throw new Error("titulo nao detectado");

    const row = {
      slug,
      titulo: String(data.titulo ?? ""),
      categoria: String(data.categoria ?? "Geral"),
      nivel_atencao: (data.nivel_atencao as string) ?? null,
      resumo: (data.resumo as string) ?? null,
      criterios_diagnosticos: data.criterios_diagnosticos ?? [],
      conduta_passos: data.conduta_passos ?? [],
      exames_solicitar: (data.exames_solicitar ?? []) as string[],
      red_flags: (data.red_flags ?? []) as string[],
      fonte: body.fonte ?? null,
      fonte_url: body.fonte_url ?? null,
      published: false,
      raw_extraction: data,
    };

    const { data: inserted, error } = await adminClient
      .from("wb_protocols")
      .upsert(row, { onConflict: "slug" })
      .select("id, slug")
      .single();
    if (error) throw error;

    return new Response(
      JSON.stringify({ success: true, mode: "protocol", id: inserted.id, slug: inserted.slug }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message ?? "Erro desconhecido" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
