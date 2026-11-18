import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { readBoundedJson } from "@/lib/server/http/read-bounded-json"
import { checkDurableRateLimit, durableRateLimitCode, durableRateLimitStatus } from "@/lib/server/security/control-plane"
import { getServiceSupabaseConfig, supabaseRest } from "@/lib/server/supabase/rest-client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "private, no-store", Vary: "Cookie, Authorization" }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function ownedExamProject(projectId: string, userId: string) {
  const result = await supabaseRest<Array<{ id: string }>>(`gh_research_projects?id=eq.${encodeURIComponent(projectId)}&owner_user_id=eq.${encodeURIComponent(userId)}&project_type=eq.examination&select=id&limit=1`)
  return result.ok ? Boolean(result.data?.length) : null
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: NO_STORE })
  const { id } = await context.params
  if (!UUID.test(id)) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404, headers: NO_STORE })
  if (!getServiceSupabaseConfig()) return NextResponse.json({ ok: false, error: "RESEARCH_STORAGE_UNAVAILABLE" }, { status: 503, headers: NO_STORE })
  const owner = await ownedExamProject(id, auth.userId)
  if (owner === null) return NextResponse.json({ ok: false, error: "EXAM_STORAGE_UNAVAILABLE" }, { status: 503, headers: NO_STORE })
  if (!owner) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404, headers: NO_STORE })
  const attempts = await supabaseRest<Array<Record<string, unknown>>>(`gh_research_exam_attempts?project_id=eq.${encodeURIComponent(id)}&select=id,attempt_number,started_at,deadline_at,submitted_at,status,answers,score,max_score,result_status&order=started_at.desc&limit=200`)
  if (!attempts.ok) return NextResponse.json({ ok: false, error: "EXAM_ATTEMPTS_UNAVAILABLE" }, { status: 503, headers: NO_STORE })
  return NextResponse.json({ ok: true, attempts: attempts.data || [] }, { headers: NO_STORE })
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: NO_STORE })
  const { id } = await context.params
  if (!UUID.test(id)) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404, headers: NO_STORE })
  const rate = await checkDurableRateLimit(`research-exam-review:${auth.userId}`, 60, 60_000, { onUnavailable: "deny" })
  if (!rate.ok) return NextResponse.json({ ok: false, error: durableRateLimitCode(rate) }, { status: durableRateLimitStatus(rate), headers: NO_STORE })
  const parsed = await readBoundedJson(request, 2 * 1024)
  if (!parsed.ok) return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400, headers: NO_STORE })
  const attemptId = typeof parsed.value.attemptId === "string" ? parsed.value.attemptId : ""
  const action = typeof parsed.value.action === "string" ? parsed.value.action : ""
  if (!UUID.test(attemptId) || !new Set(["release", "review", "void"]).has(action)) return NextResponse.json({ ok: false, error: "INVALID_EXAM_REVIEW_ACTION" }, { status: 400, headers: NO_STORE })
  if (!getServiceSupabaseConfig()) return NextResponse.json({ ok: false, error: "RESEARCH_STORAGE_UNAVAILABLE" }, { status: 503, headers: NO_STORE })
  const owner = await ownedExamProject(id, auth.userId)
  if (owner === null) return NextResponse.json({ ok: false, error: "EXAM_STORAGE_UNAVAILABLE" }, { status: 503, headers: NO_STORE })
  if (!owner) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404, headers: NO_STORE })
  const current = await supabaseRest<Array<{ id: string; status: string; result_status: string }>>(`gh_research_exam_attempts?id=eq.${encodeURIComponent(attemptId)}&project_id=eq.${encodeURIComponent(id)}&select=id,status,result_status&limit=1`)
  if (!current.ok) return NextResponse.json({ ok: false, error: "EXAM_ATTEMPTS_UNAVAILABLE" }, { status: 503, headers: NO_STORE })
  if (!current.data?.[0]) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404, headers: NO_STORE })
  const row = current.data[0]
  if (action === "void" && (! ["in_progress", "submitted", "timed_out", "reviewed"].includes(row.status) || row.result_status === "released")) return NextResponse.json({ ok: false, error: "INVALID_EXAM_ATTEMPT_TRANSITION" }, { status: 409, headers: NO_STORE })
  if (action === "release" && (!["submitted", "reviewed"].includes(row.status) || !["withheld", "under_review"].includes(row.result_status))) return NextResponse.json({ ok: false, error: "EXAM_NOT_READY_FOR_RELEASE" }, { status: 409, headers: NO_STORE })
  if (action === "review" && (row.status !== "submitted" || row.result_status !== "withheld")) return NextResponse.json({ ok: false, error: "EXAM_NOT_READY_FOR_REVIEW" }, { status: 409, headers: NO_STORE })
  const patch = action === "void" ? { status: "voided", result_status: "withheld" } : action === "release" ? { status: "reviewed", result_status: "released" } : { status: "reviewed", result_status: "under_review" }
  const updated = await supabaseRest<Array<Record<string, unknown>>>(`gh_research_exam_attempts?id=eq.${encodeURIComponent(attemptId)}&project_id=eq.${encodeURIComponent(id)}&status=eq.${encodeURIComponent(row.status)}&select=id,status,submitted_at,score,max_score,result_status`, { method: "PATCH", headers: { "Content-Type": "application/json", Prefer: "return=representation" }, body: JSON.stringify(patch) })
  if (!updated.ok) return NextResponse.json({ ok: false, error: "EXAM_REVIEW_UPDATE_FAILED" }, { status: 503, headers: NO_STORE })
  if (!updated.data?.[0]) return NextResponse.json({ ok: false, error: "EXAM_ATTEMPT_CHANGED" }, { status: 409, headers: NO_STORE })
  return NextResponse.json({ ok: true, attempt: updated.data[0] }, { headers: NO_STORE })
}
