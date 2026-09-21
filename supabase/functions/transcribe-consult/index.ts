// Edge Function: transcribe-consult
// Recebe consulta_id (audio ja foi upado pra storage 'consultas-audio').
// Le audio, manda inline pra Gemini 2.5 Flash multimodal pra transcricao em
// PT-BR com diarization (MEDICO/PACIENTE). Salva transcript + dispara
// generate-soap em sequencia.
//
// EXCECAO DELIBERADA: esta e a unica funcao que continua no Gemini, porque a
// API do Claude nao aceita audio. Precisa de GOOGLE_AI_API_KEY. A etapa
// seguinte (generate-soap) ja roda no Claude.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MAX_AUDIO_BYTES = 20 * 1024 * 1024; // 20MB inline cap Gemini

const TRANSCRIBE_PROMPT = `Voce eh um transcritor medico especializado em portugues brasileiro.
Transcreva a conversa entre medico e paciente do audio fornecido.

REGRAS:
1. Identifique falantes como [MEDICO] e [PACIENTE]. Se houver outras pessoas
   (acompanhante, enfermeira), use [ACOMPANHANTE], [ENFERMEIRO], etc.
2. Use terminologia medica correta — escreva "dispneia" (nao "falta de ar"),
   "cefaleia" (nao "dor de cabeca"), "hemoptise", "odinofagia", etc, quando
   o contexto for claramente medico.
3. Mantenha disfluencias naturais ("e", "ah", "tipo") apenas se importantes
   pro contexto. Caso contrario, limpe.
4. **PII PRIVACIDADE**: substitua CPF, RG, numeros de cartao e nomes
   completos do paciente por [REDACTED]. Mantenha apelido/primeiro nome
   se mencionados.
5. Marque silencios prolongados ou interrupcoes relevantes com [...].
6. Devolva apenas a transcricao bruta, sem cabecalhos ou comentarios.

Formato de saida (texto livre):
[MEDICO] Bom dia, como posso ajudar?
[PACIENTE] Doutor, estou com dispneia ha 3 dias...
[MEDICO] Pode descrever a dispneia? Aparece em repouso?
...`;

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

  // Verifica que user esta no beta do Scribe
  const { data: invite } = await adminClient
    .from("scribe_beta_invites")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  const { data: role } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!invite && !role) {
    return new Response(
      JSON.stringify({ error: "Acesso ao Scribe restrito ao beta fechado" }),
      {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // Body
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

  // Carrega consulta + valida ownership
  const { data: consulta } = await adminClient
    .from("consultas")
    .select("*")
    .eq("id", body.consulta_id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!consulta) {
    return new Response(
      JSON.stringify({ error: "Consulta nao encontrada ou nao pertence ao user" }),
      {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
  if (!consulta.audio_storage_path) {
    return new Response(
      JSON.stringify({ error: "Audio nao foi upado ainda" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // Marca status transcrevendo
  await adminClient
    .from("consultas")
    .update({ status: "transcrevendo", status_message: null })
    .eq("id", body.consulta_id);

  // Background processing — dispara em paralelo, retorna 202 imediato
  // (cliente ouve via Supabase Realtime na linha consultas).
  const apiKey = Deno.env.get("GOOGLE_AI_API_KEY");
  if (!apiKey) {
    await adminClient
      .from("consultas")
      .update({ status: "erro", status_message: "GOOGLE_AI_API_KEY nao configurada" })
      .eq("id", body.consulta_id);
    return new Response(JSON.stringify({ error: "GOOGLE_AI_API_KEY nao configurada" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const processInBackground = async () => {
    try {
      // Baixa audio
      const { data: audioBlob, error: dlError } = await adminClient
        .storage
        .from("consultas-audio")
        .download(consulta.audio_storage_path);
      if (dlError || !audioBlob) {
        throw new Error(`Download falhou: ${dlError?.message ?? "blob vazio"}`);
      }
      const audioArrayBuffer = await audioBlob.arrayBuffer();
      if (audioArrayBuffer.byteLength > MAX_AUDIO_BYTES) {
        throw new Error(
          `Audio muito grande (${(audioArrayBuffer.byteLength / 1024 / 1024).toFixed(1)} MB). Limite: ${MAX_AUDIO_BYTES / 1024 / 1024} MB.`,
        );
      }
      // Base64
      const u8 = new Uint8Array(audioArrayBuffer);
      let binary = "";
      const CHUNK = 0x8000;
      for (let i = 0; i < u8.length; i += CHUNK) {
        binary += String.fromCharCode.apply(
          null,
          Array.from(u8.subarray(i, i + CHUNK)),
        );
      }
      const audioBase64 = btoa(binary);

      // Detecta mime do audio
      const mimeType = audioBlob.type || "audio/webm";

      // Gemini 2.5 Flash multimodal — ~3x mais rapido que Pro pra
      // transcricao, qualidade comparavel em audios curtos/medios.
      const url =
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
      // Timeout de 90s no fetch — se Gemini pendurar, falha rapido em
      // vez de deixar o status "transcrevendo" travado pra sempre.
      const ctrl = new AbortController();
      const timeoutId = setTimeout(() => ctrl.abort(), 90_000);
      let response: Response;
      try {
        response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: ctrl.signal,
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: TRANSCRIBE_PROMPT }] },
            contents: [
              {
                role: "user",
                parts: [
                  { inlineData: { mimeType, data: audioBase64 } },
                  { text: "Transcreva a consulta seguindo as regras." },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 32768,
            },
          }),
        });
      } catch (e) {
        if ((e as Error).name === "AbortError") {
          throw new Error("Timeout de 90s no Gemini — tente novamente");
        }
        throw e;
      } finally {
        clearTimeout(timeoutId);
      }

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini API ${response.status}: ${errText.slice(0, 300)}`);
      }
      const json = await response.json();
      const transcript = json.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!transcript || transcript.length < 20) {
        throw new Error("Transcricao vazia ou muito curta");
      }

      // Salva transcript e atualiza status
      await adminClient
        .from("consultas")
        .update({
          transcript,
          status: "estruturando",
        })
        .eq("id", body.consulta_id);

      // Dispara generate-soap em sequencia (fire-and-forget)
      const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
      void fetch(`${supabaseUrl}/functions/v1/generate-soap`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
        body: JSON.stringify({ consulta_id: body.consulta_id }),
      }).catch((err) => {
        console.warn("generate-soap dispatch failed:", err);
      });
    } catch (err) {
      const msg = (err as Error).message ?? "Erro desconhecido";
      console.error("transcribe-consult fail:", msg);
      await adminClient
        .from("consultas")
        .update({
          status: "erro",
          status_message: msg.slice(0, 500),
        })
        .eq("id", body.consulta_id);
    }
  };

  // EdgeRuntime.waitUntil mantem o job vivo apos a response
  // (disponivel no Supabase Edge Functions runtime)
  // @ts-expect-error EdgeRuntime nao tem types globais
  if (typeof EdgeRuntime !== "undefined") {
    // @ts-expect-error EdgeRuntime nao tem types globais
    EdgeRuntime.waitUntil(processInBackground());
  } else {
    // Fallback: executa em paralelo sem esperar
    void processInBackground();
  }

  return new Response(
    JSON.stringify({
      success: true,
      consulta_id: body.consulta_id,
      message: "Transcricao iniciada — escute via Realtime na tabela consultas",
    }),
    {
      status: 202,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
