import { readGhcServerEnv } from "@/lib/server/economy/env"

async function rpc(fn: string, body: Record<string, unknown>) {
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return { ok: false, error: "DB_UNAVAILABLE" as const }
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
    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null
    if (!res.ok) return { ok: false, error: String(data?.message || data?.error || `HTTP_${res.status}`) }
    return { ok: true, data: data || {} }
  } catch {
    return { ok: false, error: "RPC_FAILED" }
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
