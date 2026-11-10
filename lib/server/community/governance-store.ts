import type { ServerAuthContext } from "@/lib/server/economy/auth"

const BASE = () => process.env.SUPABASE_URL?.replace(/\/$/, "")
const KEY = () => process.env.SUPABASE_SERVICE_ROLE_KEY

export class GovernanceStoreError extends Error {
  status: number
  code: string
  constructor(code: string, status = 503) { super(code); this.code = code; this.status = status }
}

function configured() { return Boolean(BASE() && KEY()) }
async function rest(path: string, init: RequestInit = {}) {
  if (!configured()) throw new GovernanceStoreError("GOVERNANCE_STORE_UNAVAILABLE")
  const response = await fetch(`${BASE()}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: KEY()!, Authorization: `Bearer ${KEY()}`,
      "Content-Type": "application/json", Accept: "application/json",
      ...(init.headers || {}),
    },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  })
  const body = await response.text()
  let data: unknown = null
  try { data = body ? JSON.parse(body) : null } catch { /* handled below */ }
  if (!response.ok) {
    const code = (data && typeof data === "object" && "message" in data && typeof data.message === "string") ? data.message : "GOVERNANCE_DATABASE_ERROR"
    throw new GovernanceStoreError(code, response.status >= 500 ? 503 : response.status)
  }
  return data
}

export async function communityRole(communityId: string, userId: string): Promise<string | null> {
  const data = await rest("rpc/gh_community_platform_role", {
    method: "POST", body: JSON.stringify({ p_community_id: communityId, p_user_id: userId }),
  })
  return typeof data === "string" && data.length ? data : null
}

export async function requireCommunityModerator(communityId: string, auth: ServerAuthContext) {
  const role = await communityRole(communityId, auth.userId)
  if (!role || !["owner", "admin", "moderator"].includes(role)) throw new GovernanceStoreError("FORBIDDEN", 403)
  return role
}

export async function insertModerationEntry(input: {
  id: string; communityId: string; actorId: string; action: string; targetType: string;
  targetId: string; metadata?: Record<string, unknown>;
}) {
  const data = await rest("rpc/gh_community_moderation_log_append", {
    method: "POST",
    body: JSON.stringify({
      p_community_id: input.communityId, p_actor_id: input.actorId,
      p_entry_id: input.id, p_action: input.action, p_target_type: input.targetType,
      p_target_id: input.targetId, p_metadata: input.metadata || {},
    }),
  }) as { ok?: boolean; durable?: boolean; error?: string }
  if (!data?.ok || !data?.durable) throw new GovernanceStoreError(data?.error || "GOVERNANCE_WRITE_FAILED", data?.error === "FORBIDDEN" ? 403 : 503)
}

export async function listModerationEntries(communityId: string) {
  return await rest(`gh_community_moderation_log?community_id=eq.${encodeURIComponent(communityId)}&select=id,community_id,actor_id,action,target_type,target_id,metadata,created_at&order=created_at.desc&limit=100`) as Array<Record<string, unknown>>
}
export async function listGovernanceReports(communityId: string) {
  return await rest(`gh_community_reports?community_id=eq.${encodeURIComponent(communityId)}&select=id,community_id,reporter_id,target_type,target_id,reason,note,status,resolution_note,resolved_by,resolved_at,created_at&order=created_at.desc&limit=100`) as Array<Record<string, unknown>>
}
export async function createGovernanceReport(input: {
  communityId: string; actorId: string; targetType: string; targetId: string; reason: string; note: string;
}) {
  return await rest("rpc/gh_community_report_create", {
    method: "POST", body: JSON.stringify({
      p_community_id: input.communityId, p_actor_id: input.actorId,
      p_target_type: input.targetType, p_target_id: input.targetId,
      p_reason: input.reason, p_note: input.note,
    }),
  })
}
export async function resolveGovernanceReport(input: {
  communityId: string; actorId: string; reportId: string; status: string; note: string;
}) {
  return await rest("rpc/gh_community_report_resolve", {
    method: "POST", body: JSON.stringify({
      p_community_id: input.communityId, p_actor_id: input.actorId,
      p_report_id: input.reportId, p_status: input.status, p_resolution_note: input.note,
    }),
  })
}
