// Guardas de autorizacao compartilhadas pelas edge functions.
//
// Toda funcao que nao for publica de proposito deve chamar uma destas guardas
// antes de fazer qualquer trabalho. Cada guarda devolve o contexto autorizado
// ou uma Response pronta (401/403) para ser retornada direto:
//
//   const auth = await requireServiceOrCron(req);
//   if (auth instanceof Response) return auth;
//
// Regras:
// - Cron e chamadas internas se identificam pelo header Authorization com a
//   service role key, ou pelo header x-cron-secret igual a CRON_SECRET.
//   Nunca por um campo do body (ex.: {source: "cron"}).
// - O token do CRM (HMAC emitido pela crm-auth) e so a identidade. As
//   permissoes (ativo, acesso_marketing, acesso_admin) sao relidas do banco a
//   cada request, para que desativar alguem tenha efeito imediato.

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const baseCorsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-crm-token, x-cron-secret",
};

export function jsonResponse(
  body: unknown,
  status = 200,
  headers: Record<string, string> = baseCorsHeaders,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

/** Comparacao em tempo constante (evita timing attack em segredos). */
export function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  let diff = ab.length ^ bb.length;
  const len = Math.max(ab.length, bb.length);
  for (let i = 0; i < len; i++) diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}

export function bearerToken(req: Request): string | null {
  const h = req.headers.get("Authorization") ?? "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

export function serviceClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

// ── Cron / chamadas internas ─────────────────────────────────────────────

export interface ServiceContext {
  kind: "service" | "cron";
}

/**
 * Aceita apenas chamadas internas: Authorization: Bearer <service role key>
 * ou x-cron-secret: <CRON_SECRET>. Qualquer outra coisa recebe 401.
 */
export function requireServiceOrCron(
  req: Request,
  cors: Record<string, string> = baseCorsHeaders,
): ServiceContext | Response {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const token = bearerToken(req);
  if (serviceKey && token && timingSafeEqual(token, serviceKey)) return { kind: "service" };

  const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
  const given = req.headers.get("x-cron-secret") ?? "";
  if (cronSecret && given && timingSafeEqual(given, cronSecret)) return { kind: "cron" };

  return jsonResponse({ error: "Unauthorized" }, 401, cors);
}

// ── Usuario do app (Supabase Auth) ───────────────────────────────────────

export interface UserContext {
  userId: string;
  email: string | null;
  token: string;
}

/** Exige um usuario logado do app (JWT do Supabase Auth). */
export async function requireUser(
  req: Request,
  cors: Record<string, string> = baseCorsHeaders,
): Promise<UserContext | Response> {
  const token = bearerToken(req);
  if (!token) return jsonResponse({ error: "Unauthorized" }, 401, cors);
  const client = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  );
  const { data, error } = await client.auth.getClaims(token);
  const sub = data?.claims?.sub;
  if (error || !sub || data?.claims?.role !== "authenticated") {
    return jsonResponse({ error: "Unauthorized" }, 401, cors);
  }
  return { userId: sub, email: (data.claims.email as string | undefined) ?? null, token };
}

/** Exige um usuario do app com papel admin em user_roles. */
export async function requireAppAdmin(
  req: Request,
  cors: Record<string, string> = baseCorsHeaders,
): Promise<UserContext | Response> {
  const user = await requireUser(req, cors);
  if (user instanceof Response) return user;
  const { data } = await serviceClient()
    .from("user_roles").select("role")
    .eq("user_id", user.userId).eq("role", "admin").maybeSingle();
  if (!data) return jsonResponse({ error: "Forbidden" }, 403, cors);
  return user;
}

/** Assinatura ativa com acesso pago (inclui free_access concedido e carencia). */
export async function hasPaidAccess(userId: string): Promise<boolean> {
  const { data, error } = await serviceClient().rpc("has_active_subscription", { _user_id: userId });
  if (error) {
    console.error("[guards] has_active_subscription falhou", error.message);
    return false;
  }
  return data === true;
}

// ── CRM (token HMAC da crm-auth) ─────────────────────────────────────────

export interface CrmContext {
  crmUserId: string;
  username: string;
  role: string;
  acessoMarketing: boolean;
  acessoAdmin: boolean;
}

function b64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Valida assinatura HMAC e expiracao do token da crm-auth. Nao olha o banco. */
export async function verifyCrmTokenSignature(
  token: string,
): Promise<Record<string, unknown> | null> {
  const secret = Deno.env.get("CRM_TOKEN_SECRET") ?? "";
  if (!token || !secret) return null;
  try {
    const [dataB64, sigB64] = token.split(".");
    if (!dataB64 || !sigB64) return null;
    const key = await crypto.subtle.importKey(
      "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"],
    );
    const dataBytes = b64ToBytes(dataB64);
    const valid = await crypto.subtle.verify("HMAC", key, b64ToBytes(sigB64), dataBytes);
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(dataBytes));
    if (typeof payload.exp !== "number" || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Exige um usuario do CRM ativo. O token vem do header x-crm-token ou, para
 * compatibilidade com o frontend atual, de `body.token`. As flags sao relidas
 * de admin_crm_users a cada chamada.
 */
export async function requireCrm(
  req: Request,
  body: Record<string, unknown> | null,
  opts: { marketing?: boolean; admin?: boolean } = {},
  cors: Record<string, string> = baseCorsHeaders,
): Promise<CrmContext | Response> {
  const token = req.headers.get("x-crm-token") ?? (typeof body?.token === "string" ? body.token : "");
  const payload = await verifyCrmTokenSignature(token);
  if (!payload?.sub) return jsonResponse({ error: "Token CRM invalido ou expirado" }, 401, cors);

  const { data: user } = await serviceClient()
    .from("admin_crm_users")
    .select("id, username, role, ativo, acesso_marketing, acesso_admin")
    .eq("id", payload.sub as string)
    .maybeSingle();
  if (!user || !user.ativo) return jsonResponse({ error: "Conta CRM desativada" }, 401, cors);

  const isAdmin = user.role === "super_admin" || user.role === "admin" || user.acesso_admin === true;
  const hasMarketing = isAdmin || user.acesso_marketing === true;
  if (opts.admin && !isAdmin) return jsonResponse({ error: "Forbidden" }, 403, cors);
  if (opts.marketing && !hasMarketing) return jsonResponse({ error: "Forbidden" }, 403, cors);

  return {
    crmUserId: user.id,
    username: user.username,
    role: user.role,
    acessoMarketing: hasMarketing,
    acessoAdmin: isAdmin,
  };
}

// ── Utilitarios ──────────────────────────────────────────────────────────

/** Escapa texto para interpolar com seguranca em HTML de e-mail. */
export function escapeHtml(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
