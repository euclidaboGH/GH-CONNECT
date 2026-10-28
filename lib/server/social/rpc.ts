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

const SOCIAL_UPSTREAM_TIMEOUT_MS = 12_000

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
        // Bound upstream latency so a stalled PostgREST request cannot pin a
        // serverless invocation indefinitely. Callers receive the existing fail-closed result.
        signal: AbortSignal.timeout(SOCIAL_UPSTREAM_TIMEOUT_MS),
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
    const timedOut = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")
    return {
      ok: false,
      data: null,
      error: timedOut ? "RPC_TIMEOUT" : "RPC_NETWORK",
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
 * Call the canonical PostgREST RPC.
 *
 * Phase 39 final convergence rule: production no longer probes historical
 * overloads or legacy function names. A missing/ambiguous signature is a
 * deployment/schema error and must surface as a 503 rather than silently
 * switching business logic.
 */
export async function socialRpc(
  fn: string,
  body: Record<string, unknown>,
): Promise<SocialRpcResult> {
  return socialRpcOnce(fn, body)
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
        // Keep direct table reads within the same upstream latency budget as RPCs.
        signal: AbortSignal.timeout(SOCIAL_UPSTREAM_TIMEOUT_MS),
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
    const timedOut = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")
    return {
      ok: false,
      data: null,
      error: timedOut ? "REST_TIMEOUT" : "REST_NETWORK",
      status: 503,
    }
  }
}
