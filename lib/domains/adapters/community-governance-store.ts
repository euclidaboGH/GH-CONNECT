/**
 * Community governance persistence seam (Step 3).
 *
 * Default: session Maps (Class C) — NOT multi-instance audit authority.
 * When GHC_GOVERNANCE_SERVER=1 and fetch succeeds, attempts server durability.
 * Never reports durable:true unless the server acknowledges persistence.
 */

import type {
  CommunityModerationLogEntry,
  CommunityReportRecord,
} from "@/lib/domains/contracts/community-governance"

export type GovernanceDurability = "session" | "server" | "unknown"

const logStore = new Map<string, CommunityModerationLogEntry[]>()
const reportStore = new Map<string, CommunityReportRecord[]>()

export function governanceServerEnabled(): boolean {
  return process.env.GHC_GOVERNANCE_SERVER === "1"
}

export function getGovernanceDurability(): GovernanceDurability {
  if (governanceServerEnabled()) return "server"
  return "session"
}

export function governanceDurabilityLabel(): string {
  return getGovernanceDurability() === "server"
    ? "Server-backed governance log"
    : "Session-only moderation log (not durable across devices)"
}

export function sessionAppendLog(entry: CommunityModerationLogEntry): void {
  const list = logStore.get(entry.communityId) || []
  list.unshift(entry)
  logStore.set(entry.communityId, list.slice(0, 200))
}

export function sessionListLogs(communityId: string): CommunityModerationLogEntry[] {
  return [...(logStore.get(communityId) || [])]
}

export function sessionAppendReport(rec: CommunityReportRecord): void {
  const list = reportStore.get(rec.communityId) || []
  list.unshift(rec)
  reportStore.set(rec.communityId, list.slice(0, 100))
}

export function sessionListReports(communityId: string): CommunityReportRecord[] {
  return [...(reportStore.get(communityId) || [])]
}

export function sessionUpdateReport(
  communityId: string,
  reportId: string,
  patch: Partial<CommunityReportRecord>
): CommunityReportRecord | null {
  const list = reportStore.get(communityId) || []
  const idx = list.findIndex((r) => r.id === reportId)
  if (idx < 0) return null
  const updated = { ...list[idx], ...patch }
  list[idx] = updated
  reportStore.set(communityId, list)
  return updated
}

/** Result of a write — durable only when server confirms */
export interface GovernanceWriteResult<T> {
  data: T
  durability: GovernanceDurability
  durable: boolean
}

/**
 * Best-effort server mirror. Failures fall back to session without claiming durability.
 */
export async function tryServerMirror(
  path: string,
  body: Record<string, unknown>
): Promise<boolean> {
  if (!governanceServerEnabled()) return false
  if (typeof fetch === "undefined") return false
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (!res.ok) return false
    const json = (await res.json().catch(() => null)) as { ok?: boolean; durable?: boolean } | null
    return Boolean(json?.ok && json?.durable)
  } catch {
    return false
  }
}
