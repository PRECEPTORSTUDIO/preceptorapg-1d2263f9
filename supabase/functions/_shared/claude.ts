// Cliente compartilhado da API do Claude (Anthropic) para as edge functions.
//
// Todas as funcoes de IA passam por aqui. Regras:
// - O modelo e unico e vem de CLAUDE_MODEL (default claude-opus-5).
// - Nunca passar `temperature`: o Claude Opus 5 rejeita o parametro.
//   Controle de "criatividade" e feito por prompt e por `effort`.
// - Chamadas nao-streaming tambem usam stream internamente e esperam a
//   mensagem final. Isso evita o timeout HTTP do SDK em max_tokens altos.
// - Fallback server-side ligado por padrao: se o modelo recusar por
//   classificador de seguranca, a API reexecuta em outro modelo Claude.
//   Desligue com CLAUDE_FALLBACKS=off.

import Anthropic from "npm:@anthropic-ai/sdk@0.127.0";

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export const CLAUDE_MODEL = Deno.env.get("CLAUDE_MODEL") ?? "claude-opus-5";
const FALLBACKS_ON = (Deno.env.get("CLAUDE_FALLBACKS") ?? "on") !== "off";
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

export type ClaudeMessage = Anthropic.Beta.BetaMessageParam;
export type ClaudeContentBlock = Anthropic.Beta.BetaContentBlockParam;

export interface ClaudeCallOptions {
  /** System prompt. Equivale ao `systemInstruction` do Gemini. */
  system?: string;
  messages: ClaudeMessage[];
  /** Equivale ao `maxOutputTokens`. Default 16000. */
  maxTokens?: number;
  /** Profundidade de raciocinio. Default "medium". */
  effort?: Effort;
  /** JSON Schema da resposta (saida estruturada). Equivale ao `responseSchema`. */
  jsonSchema?: Record<string, unknown>;
  /** Forca JSON sem schema (equivale a `responseMimeType: application/json`). */
  jsonOnly?: boolean;
  model?: string;
  /** Timeout total da requisicao em ms. Default 10 min. */
  timeoutMs?: number;
  signal?: AbortSignal;
}

let cachedClient: Anthropic | null = null;

export function getClaude(): Anthropic {
  if (cachedClient) return cachedClient;
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");
  cachedClient = new Anthropic({ apiKey, maxRetries: 2 });
  return cachedClient;
}

/** Erro HTTP do provedor de IA, com status para a edge function repassar. */
export class ClaudeError extends Error {
  status: number;
  retryable: boolean;
  constructor(message: string, status: number, retryable: boolean) {
    super(message);
    this.name = "ClaudeError";
    this.status = status;
    this.retryable = retryable;
  }
}

/** Converte qualquer erro do SDK num ClaudeError com status HTTP e flag de retry. */
export function toClaudeError(err: unknown): ClaudeError {
  if (err instanceof ClaudeError) return err;
  if (err instanceof Anthropic.RateLimitError) {
    return new ClaudeError("Limite de requisições da IA excedido. Aguarde um momento.", 429, true);
  }
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    return new ClaudeError("Chave de API da IA inválida ou sem permissão.", 403, false);
  }
  if (err instanceof Anthropic.BadRequestError) {
    return new ClaudeError(`Requisição inválida para a IA: ${err.message}`, 400, false);
  }
  if (err instanceof Anthropic.InternalServerError) {
    return new ClaudeError("Erro temporário da IA. Tente novamente.", 502, true);
  }
  if (err instanceof Anthropic.APIConnectionTimeoutError) {
    return new ClaudeError("A IA demorou demais para responder. Tente novamente.", 504, true);
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return new ClaudeError("Falha de conexão com a IA. Tente novamente.", 502, true);
  }
  if (err instanceof Anthropic.APIError) {
    const status = typeof err.status === "number" ? err.status : 500;
    return new ClaudeError(err.message, status, status >= 500);
  }
  const msg = err instanceof Error ? err.message : String(err);
  return new ClaudeError(msg, 500, false);
}

// ── Schemas ─────────────────────────────────────────────────────────────

const UNSUPPORTED_KEYS = new Set([
  "minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "multipleOf",
  "minLength", "maxLength", "pattern", "minItems", "maxItems", "uniqueItems",
  "minProperties", "maxProperties", "nullable", "propertyOrdering",
]);

/**
 * Normaliza um schema no estilo Gemini (`responseSchema`) para o JSON Schema
 * aceito pela saida estruturada do Claude: tipos em minusculo, todo objeto com
 * `additionalProperties: false` e `required` cobrindo todas as propriedades,
 * e sem restricoes numericas/de tamanho.
 */
export function toJsonSchema(schema: unknown): Record<string, unknown> {
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk);
    if (!node || typeof node !== "object") return node;
    const src = node as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(src)) {
      if (UNSUPPORTED_KEYS.has(k)) continue;
      if (k === "type" && typeof v === "string") {
        out.type = v.toLowerCase();
      } else if (k === "properties" && v && typeof v === "object") {
        const props: Record<string, unknown> = {};
        for (const [pk, pv] of Object.entries(v as Record<string, unknown>)) props[pk] = walk(pv);
        out.properties = props;
      } else if (k === "items" || k === "not") {
        out[k] = walk(v);
      } else if (k === "anyOf" || k === "oneOf" || k === "allOf") {
        out[k === "oneOf" ? "anyOf" : k] = (v as unknown[]).map(walk);
      } else if (k === "$defs" || k === "definitions") {
        const defs: Record<string, unknown> = {};
        for (const [dk, dv] of Object.entries(v as Record<string, unknown>)) defs[dk] = walk(dv);
        out.$defs = defs;
      } else {
        out[k] = v;
      }
    }
    if (src.nullable === true && typeof out.type === "string") {
      out.type = [out.type, "null"];
    }
    if (out.type === "object" || (out.properties && !out.type)) {
      out.type = "object";
      out.additionalProperties = false;
      const props = (out.properties ?? {}) as Record<string, unknown>;
      out.required = Object.keys(props);
    }
    return out;
  };
  return walk(schema) as Record<string, unknown>;
}

// ── Conteudo ────────────────────────────────────────────────────────────

/** Bloco de PDF (base64) para anexar numa mensagem de usuario. */
export function pdfBlock(base64Data: string, title?: string): ClaudeContentBlock {
  return {
    type: "document",
    source: { type: "base64", media_type: "application/pdf", data: base64Data },
    ...(title ? { title } : {}),
  };
}

/** Bloco de texto para compor mensagens com varios blocos. */
export function textBlock(text: string): ClaudeContentBlock {
  return { type: "text", text };
}

/** Mensagem de usuario com texto simples ou blocos. */
export function userMessage(content: string | ClaudeContentBlock[]): ClaudeMessage {
  return { role: "user", content };
}

export function assistantMessage(text: string): ClaudeMessage {
  return { role: "assistant", content: text };
}

/**
 * Converte o array `contents` do Gemini (`{role: "user"|"model", parts}`) para
 * mensagens do Claude. `inlineData` de PDF vira bloco `document`; outros tipos
 * de `inlineData` sao ignorados (o Claude nao processa audio).
 */
export function fromGeminiContents(
  contents: Array<{ role?: string; parts?: Array<{ text?: string; inlineData?: { mimeType?: string; data?: string } }> }>,
): ClaudeMessage[] {
  const out: ClaudeMessage[] = [];
  for (const c of contents) {
    const role = c.role === "model" || c.role === "assistant" ? "assistant" : "user";
    const blocks: ClaudeContentBlock[] = [];
    for (const p of c.parts ?? []) {
      if (typeof p.text === "string" && p.text.length > 0) blocks.push(textBlock(p.text));
      else if (p.inlineData?.mimeType === "application/pdf" && p.inlineData.data) {
        blocks.push(pdfBlock(p.inlineData.data));
      }
    }
    if (blocks.length === 0) continue;
    if (role === "assistant") {
      const text = blocks.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("");
      if (text) out.push(assistantMessage(text));
    } else {
      out.push(userMessage(blocks));
    }
  }
  // A API exige que a primeira mensagem seja de usuario.
  while (out.length && out[0].role !== "user") out.shift();
  return out;
}

// ── Chamadas ────────────────────────────────────────────────────────────

function buildParams(opts: ClaudeCallOptions): Anthropic.Beta.MessageCreateParamsStreaming {
  const params: Record<string, unknown> = {
    model: opts.model ?? CLAUDE_MODEL,
    max_tokens: opts.maxTokens ?? 16000,
    messages: opts.messages,
    stream: true,
    output_config: { effort: opts.effort ?? "medium" },
  };
  if (opts.system) params.system = opts.system;
  if (opts.jsonSchema) {
    (params.output_config as Record<string, unknown>).format = {
      type: "json_schema",
      schema: toJsonSchema(opts.jsonSchema),
    };
  }
  if (FALLBACKS_ON) {
    params.betas = [FALLBACK_BETA];
    params.fallbacks = "default";
  }
  return params as unknown as Anthropic.Beta.MessageCreateParamsStreaming;
}

function requestOptions(opts: ClaudeCallOptions) {
  return { timeout: opts.timeoutMs ?? 10 * 60 * 1000, signal: opts.signal };
}

/** Texto concatenado de todos os blocos `text` de uma mensagem. */
export function messageText(msg: Anthropic.Beta.BetaMessage): string {
  return msg.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

export interface ClaudeResult {
  text: string;
  /** end_turn | max_tokens | refusal | stop_sequence | ... */
  stopReason: string | null;
  refusalCategory: string | null;
  message: Anthropic.Beta.BetaMessage;
}

/**
 * Chamada completa (nao-streaming para quem chama). Internamente usa stream
 * para nao esbarrar em timeouts HTTP com respostas longas.
 */
export async function claudeMessage(opts: ClaudeCallOptions): Promise<ClaudeResult> {
  const client = getClaude();
  try {
    const stream = client.beta.messages.stream(buildParams(opts), requestOptions(opts));
    const message = await stream.finalMessage();
    const stopDetails = (message as unknown as { stop_details?: { category?: string | null } }).stop_details;
    return {
      text: messageText(message),
      stopReason: message.stop_reason ?? null,
      refusalCategory: message.stop_reason === "refusal" ? (stopDetails?.category ?? "unknown") : null,
      message,
    };
  } catch (err) {
    throw toClaudeError(err);
  }
}

/** Atalho: retorna so o texto. Lanca ClaudeError em recusa. */
export async function claudeText(opts: ClaudeCallOptions): Promise<string> {
  const r = await claudeMessage(opts);
  if (r.stopReason === "refusal") {
    throw new ClaudeError("Conteúdo bloqueado pelo filtro de segurança da IA.", 422, false);
  }
  return r.text;
}

/** Remove cercas ```json e extrai o primeiro objeto/array JSON do texto. */
export function extractJson(raw: string): string {
  let t = raw.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  }
  const objStart = t.indexOf("{");
  const arrStart = t.indexOf("[");
  let start = -1;
  if (objStart >= 0 && arrStart >= 0) start = Math.min(objStart, arrStart);
  else start = Math.max(objStart, arrStart);
  if (start > 0) {
    const open = t[start];
    const close = open === "{" ? "}" : "]";
    const end = t.lastIndexOf(close);
    if (end > start) t = t.slice(start, end + 1);
  }
  return t;
}

/**
 * Chamada que devolve JSON parseado. Com `jsonSchema`, a API garante a forma.
 * Sem schema, pede JSON por instrucao e extrai do texto.
 */
export async function claudeJson<T = unknown>(opts: ClaudeCallOptions): Promise<T> {
  const system = opts.jsonSchema
    ? opts.system
    : [opts.system, "Responda APENAS com JSON válido, sem markdown, sem cercas de código e sem texto fora do JSON."]
        .filter(Boolean)
        .join("\n\n");
  const r = await claudeMessage({ ...opts, system });
  if (r.stopReason === "refusal") {
    throw new ClaudeError("Conteúdo bloqueado pelo filtro de segurança da IA.", 422, false);
  }
  if (r.stopReason === "max_tokens") {
    throw new ClaudeError("A resposta da IA foi truncada (max_tokens). Aumente o limite ou reduza o pedido.", 502, true);
  }
  try {
    return JSON.parse(extractJson(r.text)) as T;
  } catch (e) {
    throw new ClaudeError(`A IA devolveu JSON inválido: ${(e as Error).message}`, 502, true);
  }
}

// ── Streaming ───────────────────────────────────────────────────────────

export interface StreamSummary {
  text: string;
  totalChars: number;
  stopReason: string | null;
  refusalCategory: string | null;
}

/**
 * Faz uma chamada em streaming e entrega cada trecho de texto em `onText`.
 * Resolve com o texto completo e o motivo de parada. Lanca ClaudeError.
 */
export async function claudeStreamText(
  opts: ClaudeCallOptions,
  onText: (delta: string) => void,
): Promise<StreamSummary> {
  const client = getClaude();
  let text = "";
  try {
    const stream = client.beta.messages.stream(buildParams(opts), requestOptions(opts));
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta" && event.delta.text) {
        text += event.delta.text;
        onText(event.delta.text);
      }
    }
    const message = await stream.finalMessage();
    const stopDetails = (message as unknown as { stop_details?: { category?: string | null } }).stop_details;
    return {
      text,
      totalChars: text.length,
      stopReason: message.stop_reason ?? null,
      refusalCategory: message.stop_reason === "refusal" ? (stopDetails?.category ?? "unknown") : null,
    };
  } catch (err) {
    throw toClaudeError(err);
  }
}

const encoder = new TextEncoder();

/** Codifica um evento SSE `data: <json>\n\n`. */
export function sseData(payload: unknown): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(payload)}\n\n`);
}

/** Evento SSE no formato que o frontend ja consome: `{choices:[{delta:{content}}]}`. */
export function sseDelta(content: string): Uint8Array {
  return sseData({ choices: [{ delta: { content } }] });
}

export const SSE_DONE = encoder.encode("data: [DONE]\n\n");

export interface SseStreamOptions extends ClaudeCallOptions {
  /** Eventos SSE extras enviados antes do primeiro delta (ja codificados). */
  prelude?: Uint8Array[];
  /** Chamado ao final com o resumo; pode devolver eventos extras antes do [DONE]. */
  onFinish?: (summary: StreamSummary) => Promise<Uint8Array[] | void> | Uint8Array[] | void;
  /** Chamado em erro; pode devolver eventos extras antes do [DONE]. */
  onError?: (err: ClaudeError) => Uint8Array[] | void;
  /** Envia `: keepalive` quando ficar mais que N ms sem emitir. Default 10s. */
  keepaliveMs?: number;
}

/**
 * Stream SSE pronto para devolver numa Response, no formato OpenAI-like que
 * o frontend ja consome. Sempre termina com `data: [DONE]`.
 */
export function claudeSseStream(opts: SseStreamOptions): ReadableStream<Uint8Array> {
  const keepaliveMs = opts.keepaliveMs ?? 10_000;
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let lastEmit = Date.now();
      let closed = false;
      const emit = (chunk: Uint8Array) => {
        if (closed) return;
        try {
          controller.enqueue(chunk);
          lastEmit = Date.now();
        } catch {
          closed = true;
        }
      };
      const ticker = setInterval(() => {
        if (Date.now() - lastEmit > keepaliveMs) emit(encoder.encode(": keepalive\n\n"));
      }, Math.min(5_000, keepaliveMs));

      try {
        for (const p of opts.prelude ?? []) emit(p);
        const summary = await claudeStreamText(opts, (delta) => emit(sseDelta(delta)));
        if (summary.stopReason === "refusal") {
          emit(sseData({ meta: { finish_reason: "SAFETY", chars: summary.totalChars, message: "Conteúdo bloqueado por filtro de segurança." } }));
        } else if (summary.stopReason === "max_tokens") {
          emit(sseData({ meta: { finish_reason: "MAX_TOKENS", chars: summary.totalChars } }));
        }
        const extra = await opts.onFinish?.(summary);
        for (const e of extra ?? []) emit(e);
      } catch (err) {
        const ce = toClaudeError(err);
        console.error("claudeSseStream error:", ce.status, ce.message);
        const extra = opts.onError?.(ce);
        if (extra && extra.length) for (const e of extra) emit(e);
        else emit(sseData({ meta: { finish_reason: "ERROR", error_code: ce.status, message: ce.message, retryable: ce.retryable } }));
      } finally {
        clearInterval(ticker);
        emit(SSE_DONE);
        closed = true;
        try { controller.close(); } catch { /* ja fechado */ }
      }
    },
  });
}

/** Headers padrao de uma resposta SSE. */
export function sseHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    ...extra,
  };
}
