/**
 * Social RPC helper — service-role only. Actor identity must be set by the API layer
 * from resolveAuthenticatedUser; never trust client-supplied actor IDs for authorization.
 */
import { readGhcServerEnv } from "@/lib/server/economy/env"

export function socialDbConfigured(): boolean {
  const env = readGhcServerEnv()
  return Boolean(env.supabaseUrl && env.supabaseServiceRoleKey)
}

export async function socialRpc(
  fn: string,
  body: Record<string, unknown>
): Promise<{ ok: boolean; data: unknown; error?: string; status: number }> {
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    return { ok: false, data: null, error: "DB_UNAVAILABLE", status: 503 }
  }
  try {
    const res = await fetch(
      `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/${fn}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: env.supabaseServiceRoleKey,
          Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
        },
        body: JSON.stringify(body),
        cache: "no-store",
      }
    )
    const text = await res.text()
    let data: unknown = null
    if (text && text !== "null") {
      try {
        data = JSON.parse(text)
      } catch {
        data = { raw: text.slice(0, 200) }
      }
    }
    if (!res.ok) {
      return {
        ok: false,
        data,
        error: `RPC_${fn}_HTTP_${res.status}`,
        status: res.status,
      }
    }
    return { ok: true, data, status: 200 }
  } catch (e) {
    return {
      ok: false,
      data: null,
      error: e instanceof Error ? e.message : "RPC_NETWORK",
      status: 503,
    }
  }
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
      return { ok: false, data, error: `REST_HTTP_${res.status}`, status: res.status }
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
