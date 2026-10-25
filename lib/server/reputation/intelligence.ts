import { readGhcServerEnv } from "@/lib/server/economy/env"

type RpcResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; error: string }

function safeRpcError(status: number, payload: Record<string, unknown> | null): string {
  // Keep useful PostgREST / PostgreSQL codes for operator diagnostics without
  // logging arbitrary server messages that may contain schema or deployment detail.
  const code = String(payload?.code || "").trim().toUpperCase()
  const message = String(payload?.message || payload?.error || "").trim()
  if (/^PGRST\d{3}$/.test(code)) return code
  if (/^[0-9A-Z]{5}$/.test(code)) return `SQLSTATE_${code}`
  if (/schema cache/i.test(message)) return "POSTGREST_SCHEMA_CACHE_STALE"
  if (/does not exist|not found/i.test(message)) return "RPC_OR_DEPENDENCY_NOT_FOUND"
  if (status === 401 || status === 403) return "SERVICE_ROLE_PERMISSION_DENIED"
  return `HTTP_${status}`
}

async function rpc(fn: string, body: Record<string, unknown>): Promise<RpcResult> {
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return { ok: false, error: "DB_UNAVAILABLE" }
  try {
    const res = await fetch(`${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: env.supabaseServiceRoleKey,
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    })
    const payload: unknown = await res.json().catch(() => null)
    const data = payload && typeof payload === "object" && !Array.isArray(payload)
      ? payload as Record<string, unknown>
      : null
    if (!res.ok) return { ok: false, error: safeRpcError(res.status, data) }
    if (!data) return { ok: false, error: "RPC_RESPONSE_INVALID" }
    return { ok: true, data }
  } catch {
    return { ok: false, error: "RPC_NETWORK_FAILURE" }
  }
}

export async function refreshReputationIntelligence(userId: string) {
  const result = await rpc("gh_reputation_intelligence_refresh", { p_user_id: userId })
  if (!result.ok || !result.data) return { ok: false as const, error: result.error }
  if (result.data.ok === false) return { ok: false as const, error: String(result.data.error || "REFRESH_FAILED") }
  return { ok: true as const, data: result.data }
}

export async function getPublicReputationIntelligence(userId: string) {
  const result = await rpc("gh_reputation_intelligence_get", { p_user_id: userId })
  if (!result.ok || !result.data) return { ok: false as const, error: result.error }
  if (result.data.ok === false) return { ok: false as const, error: String(result.data.error || "GET_FAILED") }
  return { ok: true as const, data: result.data }
}
