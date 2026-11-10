import { NextRequest, NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { readBoundedJson } from "@/lib/server/http/read-bounded-json"
import { GovernanceStoreError, insertModerationEntry, listModerationEntries, requireCommunityModerator } from "@/lib/server/community/governance-store"
import { enforceUserMutationRateLimit } from "@/lib/server/security/user-rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const ACTIONS = new Set(["pin", "unpin", "hide", "unhide", "report", "lifecycle", "role_change", "remove_member", "ban_member", "unban_member", "announcement", "event", "resource"])
const TARGETS = new Set(["post", "member", "community", "report", "announcement", "event", "resource"])
const id = (v: unknown, max = 128) => typeof v === "string" && v.trim().length > 0 && v.trim().length <= max ? v.trim() : ""
function fail(error: unknown) {
  if (error instanceof GovernanceStoreError) return NextResponse.json({ ok: false, error: error.code }, { status: error.status })
  return NextResponse.json({ ok: false, error: "GOVERNANCE_STORE_UNAVAILABLE" }, { status: 503 })
}
export async function GET(req: NextRequest) {
  const auth = await resolveAuthenticatedUser(req.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  const communityId = id(req.nextUrl.searchParams.get("communityId"))
  if (!communityId) return NextResponse.json({ ok: false, error: "INVALID_COMMUNITY" }, { status: 400 })
  try {
    await requireCommunityModerator(communityId, auth)
    const entries = await listModerationEntries(communityId)
    return NextResponse.json({ ok: true, durable: true, durability: "server", entries })
  } catch (error) { return fail(error) }
}
export async function POST(req: NextRequest) {
  const auth = await resolveAuthenticatedUser(req.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  const __rateLimited = await enforceUserMutationRateLimit(auth.userId, "governance/moderation-log:POST", 60, 60_000, { failClosed: false })
  if (__rateLimited) return __rateLimited
  const parsed = await readBoundedJson(req, 12 * 1024)
  if (!parsed.ok) return NextResponse.json({ ok: false, error: parsed.error }, { status: parsed.error === "REQUEST_TOO_LARGE" ? 413 : 400 })
  const candidate = parsed.value.entry
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return NextResponse.json({ ok: false, error: "INVALID_ENTRY" }, { status: 400 })
  const entry = candidate as Record<string, unknown>
  const communityId = id(entry.communityId), action = id(entry.action, 80), targetType = id(entry.targetType, 40), targetId = id(entry.targetId)
  const entryId = id(entry.id, 128) || `mlog_${crypto.randomUUID()}`
  if (!communityId || !ACTIONS.has(action) || !TARGETS.has(targetType) || !targetId) return NextResponse.json({ ok: false, error: "INVALID_ENTRY" }, { status: 400 })
  try {
    await requireCommunityModerator(communityId, auth)
    const metadata = entry.metadata && typeof entry.metadata === "object" && !Array.isArray(entry.metadata) ? entry.metadata as Record<string, unknown> : {}
    await insertModerationEntry({ id: entryId, communityId, actorId: auth.userId, action, targetType, targetId, metadata })
    return NextResponse.json({ ok: true, durable: true, durability: "server", entryId }, { status: 201 })
  } catch (error) { return fail(error) }
}
