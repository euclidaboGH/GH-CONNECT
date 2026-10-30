import { hasPrivilegedDatabase, readGhcServerEnv } from "@/lib/server/economy/env"

async function treasuryRpc<T>(name: string, body: Record<string, unknown>): Promise<T | null> {
  if (!hasPrivilegedDatabase()) return null
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return null
  try {
    const response = await fetch(`${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/${name}`, {
      method: "POST", headers: { "Content-Type": "application/json", apikey: env.supabaseServiceRoleKey,
        Authorization: `Bearer ${env.supabaseServiceRoleKey}` }, body: JSON.stringify(body), cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) return null
    return await response.json() as T
  } catch { return null }
}

export function getTreasuryFinancialReport(startsAt: string, endsAt: string) {
  return treasuryRpc<{ ok?: boolean; [key: string]: unknown }>("gh_treasury_financial_report", {
    p_starts_at: startsAt, p_ends_at: endsAt,
  })
}

export function listTreasuryCases(limit = 100) {
  return treasuryRpc<{ ok?: boolean; items?: unknown[] }>("gh_treasury_case_list", { p_limit: limit })
}

export function upsertTreasuryCase(input: {
  caseKey: string; sourceKind: string; sourceId: string; summary: string; actor: string;
  eventType?: string; note?: string; status?: string; priority?: string;
}) {
  return treasuryRpc<{ ok?: boolean; error?: string; caseId?: string; status?: string; created?: boolean }>("gh_treasury_case_upsert", {
    p_case_key: input.caseKey, p_source_kind: input.sourceKind, p_source_id: input.sourceId,
    p_summary: input.summary, p_actor: input.actor, p_event_type: input.eventType || "note_added",
    p_note: input.note || null, p_status: input.status || null, p_priority: input.priority || null,
  })
}

export function getMembershipReconciliationReport(limit = 100) {
  return treasuryRpc<{ ok?: boolean; items?: unknown[]; mutatesEntitlements?: boolean }>("ghc_membership_reconciliation_report", { p_limit: limit })
}
