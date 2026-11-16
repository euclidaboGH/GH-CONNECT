/**
 * Central Supabase REST / RPC client (Phase 4).
 *
 * Goal: replace ad-hoc fetch(`${supabaseUrl}/rest/v1/...`) call sites with one
 * privileged, timeout-bounded, header-consistent helper. Service-role credentials
 * never leave the server.
 */
import { readGhcServerEnv } from "@/lib/server/economy/env"

export type SupabaseRestConfig = {
  baseUrl: string
  serviceRoleKey: string
}

export type RestResult<T> =
  | { ok: true; data: T; status: number }
  | { ok: false; status: number; error: string; body?: unknown }

export function getServiceSupabaseConfig(): SupabaseRestConfig | null {
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return null
  return {
    baseUrl: env.supabaseUrl.replace(/\/$/, ""),
    serviceRoleKey: env.supabaseServiceRoleKey,
  }
}

function serviceHeaders(key: string, extra?: HeadersInit): Headers {
  const h = new Headers(extra)
  h.set("apikey", key)
  h.set("Authorization", `Bearer ${key}`)
  if (!h.has("Accept")) h.set("Accept", "application/json")
  return h
}

/** POST /rest/v1/rpc/{fn} with JSON body. */
export async function supabaseRpc<T = unknown>(
  fn: string,
  body: Record<string, unknown> = {},
  options: { timeoutMs?: number; config?: SupabaseRestConfig | null } = {},
): Promise<RestResult<T>> {
  const config = options.config === undefined ? getServiceSupabaseConfig() : options.config
  if (!config) return { ok: false, status: 503, error: "SUPABASE_NOT_CONFIGURED" }
  const name = String(fn || "").replace(/[^a-zA-Z0-9_]/g, "")
  if (!name || name.length > 128) return { ok: false, status: 400, error: "INVALID_RPC_NAME" }

  try {
    const res = await fetch(`${config.baseUrl}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: serviceHeaders(config.serviceRoleKey, { "Content-Type": "application/json" }),
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(options.timeoutMs ?? 15_000),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      return { ok: false, status: res.status, error: `SUPABASE_RPC_HTTP_${res.status}`, body: data }
    }
    return { ok: true, data: data as T, status: res.status }
  } catch (err) {
    const message =
      err instanceof Error && err.name === "TimeoutError" ? "SUPABASE_RPC_TIMEOUT" : "SUPABASE_RPC_NETWORK"
    return { ok: false, status: 503, error: message }
  }
}

/** REST against /rest/v1/{path} (path may include query string). */
export async function supabaseRest<T = unknown>(
  path: string,
  init: RequestInit & { timeoutMs?: number; config?: SupabaseRestConfig | null } = {},
): Promise<RestResult<T>> {
  const config = init.config === undefined ? getServiceSupabaseConfig() : init.config
  if (!config) return { ok: false, status: 503, error: "SUPABASE_NOT_CONFIGURED" }
  const rel = String(path || "").replace(/^\//, "")
  if (!rel || rel.includes("://")) return { ok: false, status: 400, error: "INVALID_REST_PATH" }

  const { timeoutMs, config: _c, ...fetchInit } = init
  try {
    const headers = serviceHeaders(config.serviceRoleKey, fetchInit.headers)
    const res = await fetch(`${config.baseUrl}/rest/v1/${rel}`, {
      ...fetchInit,
      headers,
      cache: "no-store",
      signal: fetchInit.signal ?? AbortSignal.timeout(timeoutMs ?? 15_000),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      return { ok: false, status: res.status, error: `SUPABASE_REST_HTTP_${res.status}`, body: data }
    }
    return { ok: true, data: data as T, status: res.status }
  } catch (err) {
    const message =
      err instanceof Error && err.name === "TimeoutError" ? "SUPABASE_REST_TIMEOUT" : "SUPABASE_REST_NETWORK"
    return { ok: false, status: 503, error: message }
  }
}
