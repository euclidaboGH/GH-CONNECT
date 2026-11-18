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
  | { ok: true; data: T; status: number; headers: Headers }
  | { ok: false; status: number; error: string; body?: unknown; headers: Headers }

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
  if (!config) return { ok: false, status: 503, error: "SUPABASE_NOT_CONFIGURED", headers: new Headers() }
  const name = String(fn || "").replace(/[^a-zA-Z0-9_]/g, "")
  if (!name || name.length > 128) return { ok: false, status: 400, error: "INVALID_RPC_NAME", headers: new Headers() }

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
      return { ok: false, status: res.status, error: `SUPABASE_RPC_HTTP_${res.status}`, body: data, headers: res.headers }
    }
    return { ok: true, data: data as T, status: res.status, headers: res.headers }
  } catch (err) {
    const message =
      err instanceof Error && err.name === "TimeoutError" ? "SUPABASE_RPC_TIMEOUT" : "SUPABASE_RPC_NETWORK"
    return { ok: false, status: 503, error: message, headers: new Headers() }
  }
}

/** REST against /rest/v1/{path} (path may include query string). */
export async function supabaseRest<T = unknown>(
  path: string,
  init: RequestInit & { timeoutMs?: number; maxResponseBytes?: number; config?: SupabaseRestConfig | null } = {},
): Promise<RestResult<T>> {
  const config = init.config === undefined ? getServiceSupabaseConfig() : init.config
  if (!config) return { ok: false, status: 503, error: "SUPABASE_NOT_CONFIGURED", headers: new Headers() }
  const rel = String(path || "").replace(/^\//, "")
  if (!rel || rel.includes("://")) return { ok: false, status: 400, error: "INVALID_REST_PATH", headers: new Headers() }

  const { timeoutMs, maxResponseBytes, config: _c, ...fetchInit } = init
  if (maxResponseBytes !== undefined && (!Number.isSafeInteger(maxResponseBytes) || maxResponseBytes < 1 || maxResponseBytes > 10 * 1024 * 1024)) {
    return { ok: false, status: 400, error: "INVALID_RESPONSE_LIMIT", headers: new Headers() }
  }
  try {
    const headers = serviceHeaders(config.serviceRoleKey, fetchInit.headers)
    const res = await fetch(`${config.baseUrl}/rest/v1/${rel}`, {
      ...fetchInit,
      headers,
      cache: "no-store",
      signal: fetchInit.signal ?? AbortSignal.timeout(timeoutMs ?? 15_000),
    })
    let data: unknown = null
    if (maxResponseBytes !== undefined) {
      const declaredLength = res.headers.get("content-length")
      if (declaredLength !== null && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > maxResponseBytes)) {
        return { ok: false, status: 502, error: "SUPABASE_REST_RESPONSE_TOO_LARGE", headers: res.headers }
      }
      if (!res.body) return { ok: false, status: 502, error: "SUPABASE_REST_EMPTY_RESPONSE", headers: res.headers }
      const reader = res.body.getReader()
      const chunks: Uint8Array[] = []
      let total = 0
      try {
        while (true) {
          const part = await reader.read()
          if (part.done) break
          total += part.value.byteLength
          if (total > maxResponseBytes) {
            await reader.cancel("response exceeds configured byte limit").catch(() => undefined)
            return { ok: false, status: 502, error: "SUPABASE_REST_RESPONSE_TOO_LARGE", headers: res.headers }
          }
          chunks.push(part.value)
        }
      } finally {
        reader.releaseLock()
      }
      const bytes = new Uint8Array(total)
      let offset = 0
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
      try { data = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) }
      catch { return { ok: false, status: 502, error: "SUPABASE_REST_INVALID_JSON", headers: res.headers } }
    } else {
      data = await res.json().catch(() => null)
    }
    if (!res.ok) {
      return { ok: false, status: res.status, error: `SUPABASE_REST_HTTP_${res.status}`, body: data, headers: res.headers }
    }
    return { ok: true, data: data as T, status: res.status, headers: res.headers }
  } catch (err) {
    const message =
      err instanceof Error && err.name === "TimeoutError" ? "SUPABASE_REST_TIMEOUT" : "SUPABASE_REST_NETWORK"
    return { ok: false, status: 503, error: message, headers: new Headers() }
  }
}
