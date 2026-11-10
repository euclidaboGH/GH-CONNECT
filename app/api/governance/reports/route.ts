import { NextRequest, NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { readBoundedJson } from "@/lib/server/http/read-bounded-json"
import { GovernanceStoreError, createGovernanceReport, listGovernanceReports, requireCommunityModerator, resolveGovernanceReport } from "@/lib/server/community/governance-store"
import { enforceUserMutationRateLimit } from "@/lib/server/security/user-rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const TARGETS = new Set(["community", "post", "member", "event", "resource"])
const REASONS = new Set(["spam", "harassment", "hate", "misinformation", "impersonation", "safety", "other"])
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
    const reports = await listGovernanceReports(communityId)
    return NextResponse.json({ ok: true, durable: true, durability: "server", reports })
  } catch (error) { return fail(error) }
}
export async function POST(req: NextRequest) {
  const auth = await resolveAuthenticatedUser(req.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  const __rateLimited = await enforceUserMutationRateLimit(auth.userId, "governance/reports:POST", 20, 60_000, { failClosed: false })
  if (__rateLimited) return __rateLimited
  const parsed = await readBoundedJson(req, 12 * 1024)
  if (!parsed.ok) return NextResponse.json({ ok: false, error: parsed.error }, { status: parsed.error === "REQUEST_TOO_LARGE" ? 413 : 400 })
  const payload = parsed.value
  const report = payload.report && typeof payload.report === "object" && !Array.isArray(payload.report) ? payload.report as Record<string, unknown> : payload
  const communityId = id(report.communityId), targetType = id(report.targetType, 40), targetId = id(report.targetId), reason = id(report.reason, 40)
  if (!communityId || !TARGETS.has(targetType) || !targetId || !REASONS.has(reason)) return NextResponse.json({ ok: false, error: "INVALID_REPORT" }, { status: 400 })
  try {
    if (payload.action === "resolve") {
      const status = id(report.status, 20)
      if (!["reviewing", "resolved", "dismissed"].includes(status)) return NextResponse.json({ ok: false, error: "INVALID_STATUS" }, { status: 400 })
      await requireCommunityModerator(communityId, auth)
      const reportId = id(report.id)
      if (!reportId) return NextResponse.json({ ok: false, error: "INVALID_REPORT_ID" }, { status: 400 })
      const result = await resolveGovernanceReport({ communityId, actorId: auth.userId, reportId, status, note: typeof report.resolutionNote === "string" ? report.resolutionNote.slice(0, 2000) : "" }) as { ok?: boolean; error?: string }
      if (!result?.ok) return NextResponse.json({ ok: false, error: result?.error || "REPORT_RESOLUTION_FAILED" }, { status: result?.error === "FORBIDDEN" ? 403 : result?.error === "NOT_FOUND" ? 404 : 409 })
      return NextResponse.json({ ok: true, durable: true, durability: "server", result })
    }
    const note = typeof report.note === "string" ? report.note.slice(0, 2000) : ""
    const result = await createGovernanceReport({ communityId, actorId: auth.userId, targetType, targetId, reason, note }) as { ok?: boolean; error?: string; duplicate?: boolean }
    if (!result?.ok) return NextResponse.json({ ok: false, error: result?.error || "REPORT_CREATE_FAILED" }, { status: result?.error === "FORBIDDEN" ? 403 : 409 })
    return NextResponse.json({ ok: true, durable: true, durability: "server", result }, { status: 201 })
  } catch (error) { return fail(error) }
}
