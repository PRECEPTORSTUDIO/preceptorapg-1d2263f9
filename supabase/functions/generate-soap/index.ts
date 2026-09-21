// Edge Function: generate-soap
// Recebe consulta_id (transcript ja salvo). Le transcript, manda pro Claude
// com schema rigido pra estruturar em SOAP (S/O/A).
// Phase 4 estendera com P (Plano) + DDx + exames + prescricao.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { claudeJson, toClaudeError } from "../_shared/claude.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SOAP_SYSTEM_PROMPT = `Voce eh um Preceptor Academico de Medicina especializado em
documentacao clinica. Recebe transcricao de consulta medica em PT-BR e
produz prontuario estruturado em formato SOAP completo (S/O/A/P) +
DDx + exames sugeridos + rascunho de prescricao.

REGRAS CRITICAS:
1. Use APENAS informacao presente na transcricao. NAO invente dados,
   sinais vitais, exames, diagnosticos ou medicacoes que o medico nao
   mencionou explicitamente.
2. Linguagem medica formal em PT-BR. Use terminologia tecnica:
   "dispneia", "cefaleia", "ortopneia", "hemoptise", "odinofagia",
   "hematemese", etc.
3. Objetividade. 3a pessoa ("paciente refere..." nao "voce disse...").
4. PII: substitua nome completo, CPF, RG, telefone por [REDACTED]
   se aparecerem na transcricao.
5. Se um campo nao foi abordado, devolva string vazia "" ou array
   vazio. NAO escreva "nao informado" — deixe vazio pro medico.
6. Em "hipoteses_diagnosticas": sugira CIDs apenas quando o medico
   articulou claramente um diagnostico ou suspeita. NAO invente.
7. Em "prescricao_rascunho": NUNCA prescreva medicamento que o medico
   nao mencionou. Se o medico citou ("vou prescrever amoxicilina"),
   estruture com posologia padrao da literatura. Marque sempre como
   RASCUNHO. O medico edita/confirma antes de assinar.

ESTRUTURA:

S (Subjetivo): queixa_principal, hda, antecedentes_pessoais,
antecedentes_familiares, medicacoes_em_uso[], alergias[], habitos.

O (Objetivo): sinais_vitais{pa,fc,fr,temperatura,sato2,peso,altura},
exame_fisico_geral, exame_fisico_segmentar[{segmento,achados}].

A (Avaliacao): hipoteses_diagnosticas[{cid,descricao,probabilidade}],
comentario.

P (Plano): conduta (texto livre), exames_solicitados[],
prescricao_rascunho[{medicamento,posologia,duracao,observacoes}],
orientacoes (texto), retorno (quando rever paciente).

Devolva APENAS JSON valido conforme schema. Sem markdown. Sem cabecalhos.`;

const SOAP_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    S: {
      type: "OBJECT",
      properties: {
        queixa_principal: { type: "STRING" },
        hda: { type: "STRING" },
        antecedentes_pessoais: { type: "STRING" },
        antecedentes_familiares: { type: "STRING" },
        medicacoes_em_uso: { type: "ARRAY", items: { type: "STRING" } },
        alergias: { type: "ARRAY", items: { type: "STRING" } },
        habitos: { type: "STRING" },
      },
    },
    O: {
      type: "OBJECT",
      properties: {
        sinais_vitais: {
          type: "OBJECT",
          properties: {
            pa: { type: "STRING" },
            fc: { type: "STRING" },
            fr: { type: "STRING" },
            temperatura: { type: "STRING" },
            sato2: { type: "STRING" },
            peso: { type: "STRING" },
            altura: { type: "STRING" },
          },
        },
        exame_fisico_geral: { type: "STRING" },
        exame_fisico_segmentar: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              segmento: { type: "STRING" },
              achados: { type: "STRING" },
            },
          },
        },
      },
    },
    A: {
      type: "OBJECT",
      properties: {
        hipoteses_diagnosticas: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              cid: { type: "STRING" },
              descricao: { type: "STRING" },
              probabilidade: { type: "STRING" },
            },
          },
        },
        comentario: { type: "STRING" },
      },
    },
    P: {
      type: "OBJECT",
      properties: {
        conduta: { type: "STRING" },
        exames_solicitados: { type: "ARRAY", items: { type: "STRING" } },
        prescricao_rascunho: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              medicamento: { type: "STRING" },
              posologia: { type: "STRING" },
              duracao: { type: "STRING" },
              observacoes: { type: "STRING" },
            },
          },
        },
        orientacoes: { type: "STRING" },
        retorno: { type: "STRING" },
      },
    },
  },
  required: ["S", "O", "A", "P"],
};

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

  let body: { consulta_id?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON invalido" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!body.consulta_id) {
    return new Response(JSON.stringify({ error: "consulta_id obrigatorio" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: consulta } = await adminClient
    .from("consultas")
    .select("*")
    .eq("id", body.consulta_id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!consulta) {
    return new Response(
      JSON.stringify({ error: "Consulta nao encontrada" }),
      {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
  if (!consulta.transcript || consulta.transcript.length < 20) {
    return new Response(
      JSON.stringify({ error: "Transcript vazio ou muito curto" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  try {
    let soap;
    try {
      soap = await claudeJson({
        system: SOAP_SYSTEM_PROMPT,
        messages: [{
          role: "user",
          content: `Transcricao da consulta:\n\n${consulta.transcript}\n\nEstruture em SOAP conforme schema.`,
        }],
        jsonSchema: SOAP_RESPONSE_SCHEMA,
        maxTokens: 16384,
        effort: "medium",
      });
    } catch (e) {
      const ce = toClaudeError(e);
      throw new Error(`IA ${ce.status}: ${ce.message.slice(0, 300)}`);
    }

    await adminClient
      .from("consultas")
      .update({
        soap_jsonb: soap,
        status: "pendente_revisao",
      })
      .eq("id", body.consulta_id);

    // Log da chamada
    void adminClient.from("generation_logs").insert({
      user_id: userId,
      function_name: "generate-soap",
    });

    return new Response(
      JSON.stringify({ success: true, consulta_id: body.consulta_id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = (err as Error).message ?? "Erro desconhecido";
    console.error("generate-soap fail:", msg);
    await adminClient
      .from("consultas")
      .update({ status: "erro", status_message: msg.slice(0, 500) })
      .eq("id", body.consulta_id);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
