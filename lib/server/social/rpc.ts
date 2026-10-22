/**
 * Social RPC helper — service-role only. Actor identity must be set by the API layer
 * from resolveAuthenticatedUser; never trust client-supplied actor IDs for authorization.
 *
 * PostgREST notes:
 * - HTTP 404 with code PGRST202 usually means no matching *signature* in the schema cache
 *   (wrong/extra args, or overloaded functions), not merely "function name missing".
 * - EXECUTE is granted to service_role only; browser never calls these RPCs.
 */
import { readGhcServerEnv } from "@/lib/server/economy/env"

export function socialDbConfigured(): boolean {
  const env = readGhcServerEnv()
  return Boolean(env.supabaseUrl && env.supabaseServiceRoleKey)
}

export type SocialRpcResult = {
  ok: boolean
  data: unknown
  error?: string
  status: number
  fn?: string
  /** True when a non-primary function was used */
  usedFallback?: boolean
  /** PostgREST / Postgres diagnostic code when present (e.g. PGRST202) */
  diagnosticCode?: string
  diagnosticMessage?: string
}

function parsePostgrestBody(text: string): {
  data: unknown
  code?: string
  message?: string
  hint?: string
  details?: string
} {
  if (!text || text === "null") return { data: null }
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>
    const code = typeof parsed.code === "string" ? parsed.code : undefined
    const message = typeof parsed.message === "string" ? parsed.message : undefined
    const hint = typeof parsed.hint === "string" ? parsed.hint : undefined
    const details = typeof parsed.details === "string" ? parsed.details : undefined
    return { data: parsed, code, message, hint, details }
  } catch {
    return { data: { raw: text.slice(0, 240) } }
  }
}

function logRpcFailure(info: {
  fn: string
  status: number
  code?: string
  message?: string
}): void {
  try {
    // Never log keys, tokens, or full request bodies
    console.warn(
      `[socialRpc] fn=${info.fn} status=${info.status} code=${info.code || "-"} msg=${(info.message || "").slice(0, 180)}`
    )
  } catch {
    /* */
  }
}

async function socialRpcOnce(
  fn: string,
  body: Record<string, unknown>
): Promise<SocialRpcResult> {
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    return { ok: false, data: null, error: "DB_UNAVAILABLE", status: 503, fn }
  }
  try {
    const res = await fetch(
      `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/${encodeURIComponent(fn)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          // Explicit public schema — avoids profile mismatch on multi-schema projects
          "Content-Profile": "public",
          "Accept-Profile": "public",
          apikey: env.supabaseServiceRoleKey,
          Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
        },
        body: JSON.stringify(body),
        cache: "no-store",
      }
    )
    const text = await res.text()
    const parsed = parsePostgrestBody(text)
    if (!res.ok) {
      logRpcFailure({
        fn,
        status: res.status,
        code: parsed.code,
        message: parsed.message,
      })
      return {
        ok: false,
        data: parsed.data,
        error: `RPC_${fn}_HTTP_${res.status}`,
        status: res.status,
        fn,
        diagnosticCode: parsed.code,
        diagnosticMessage: parsed.message || parsed.hint || parsed.details,
      }
    }
    return {
      ok: true,
      data: parsed.data,
      status: 200,
      fn,
    }
  } catch (e) {
    return {
      ok: false,
      data: null,
      error: e instanceof Error ? e.message : "RPC_NETWORK",
      status: 503,
      fn,
    }
  }
}

function isMissingOrAmbiguousSignature(r: SocialRpcResult): boolean {
  if (r.ok) return false
  if (r.status === 404) return true
  const code = String(r.diagnosticCode || "")
  // PGRST202 = no function matches; PGRST203 = ambiguous overload
  if (code === "PGRST202" || code === "PGRST203") return true
  return false
}

/**
 * Call PostgREST RPC with optional ordered fallbacks.
 * Fallbacks run only when the primary is missing/ambiguous (404 / PGRST202 / PGRST203).
 */
export async function socialRpc(
  fn: string,
  body: Record<string, unknown>,
  options?: {
    /** Ordered alternate { name, body } pairs tried only on signature-miss */
    fallbacks?: Array<{ fn: string; body: Record<string, unknown> }>
  }
): Promise<SocialRpcResult> {
  const primary = await socialRpcOnce(fn, body)
  if (!isMissingOrAmbiguousSignature(primary)) return primary

  const builtIn: Array<{ fn: string; body: Record<string, unknown> }> = []
  if (fn === "gh_post_curation_set_with_reward") {
    // 4-arg historical overload (pre-GHPV weight)
    builtIn.push({
      fn: "gh_post_curation_set_with_reward",
      body: {
        p_post_id: body.p_post_id,
        p_user_id: body.p_user_id,
        p_choice: body.p_choice,
        p_percentage: body.p_percentage ?? 100,
      },
    })
    // Vote-only — reward path not executed
    builtIn.push({
      fn: "gh_post_curation_set",
      body: {
        p_post_id: body.p_post_id,
        p_user_id: body.p_user_id,
        p_choice: body.p_choice,
      },
    })
  }

  const chain = [...(options?.fallbacks || []), ...builtIn]
  for (const step of chain) {
    if (step.fn === fn && JSON.stringify(step.body) === JSON.stringify(body)) continue
    const secondary = await socialRpcOnce(step.fn, step.body)
    if (!isMissingOrAmbiguousSignature(secondary)) {
      return {
        ...secondary,
        usedFallback: true,
      }
    }
  }
  return primary
}

export async function socialRest<T = unknown>(
  pathAndQuery: string
): Promise<{ ok: boolean; data: T | null; error?: string; status: number }> {
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    return { ok: false, data: null, error: "DB_UNAVAILABLE", status: 503 }
  }
  try {
    const res = await fetch(
      `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/${pathAndQuery.replace(/^\//, "")}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Accept-Profile": "public",
          apikey: env.supabaseServiceRoleKey,
          Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
        },
        cache: "no-store",
      }
    )
    const text = await res.text()
    let data: T | null = null
    if (text && text !== "null") {
      try {
        data = JSON.parse(text) as T
      } catch {
        data = null
      }
    }
    if (!res.ok) {
      return {
        ok: false,
        data: null,
        error: `REST_HTTP_${res.status}`,
        status: res.status,
      }
    }
    return { ok: true, data, status: 200 }
  } catch (e) {
    return {
      ok: false,
      data: null,
      error: e instanceof Error ? e.message : "REST_NETWORK",
      status: 503,
    }
  }
}
