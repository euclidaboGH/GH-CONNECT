import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { readBoundedJson } from "@/lib/server/http/read-bounded-json"
import { checkDurableRateLimit, durableRateLimitCode, durableRateLimitStatus } from "@/lib/server/security/control-plane"
import { supabaseRest } from "@/lib/server/supabase/rest-client"
export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const noStore = { "Cache-Control": "private, no-store", Vary: "Cookie, Authorization" }
async function isAdmin(request: Request) { const auth = await resolveAuthenticatedUser(request.headers); const id = String(process.env.GHC_FIELD_ADMIN_USER_ID || "").trim(); return auth && id && auth.userId === id ? auth : null }
export async function GET(request: Request) {
  const auth = await isAdmin(request)
  if (!auth) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403, headers: noStore })
  const rate = await checkDurableRateLimit(`central-evidence-queue:${auth.userId}`, 30, 60_000, { onUnavailable: "deny" })
  if (!rate.ok) return NextResponse.json({ ok: false, error: durableRateLimitCode(rate) }, { status: durableRateLimitStatus(rate), headers: noStore })
  type EvidenceQueueBase = { id: string; sha256: string | null; scan_status: string; verification_status: string; geo_unit_id: string | null; uploaded_by: string | null; created_at: string }
  type ResearchEvidence = EvidenceQueueBase & { project_id: string; response_id: string | null; media_asset_id: string | null; media_kind: string; mime_type: string; byte_size: number; captured_at: string | null }
  type FieldEvidence = EvidenceQueueBase & { report_id: string; media_asset_id: string }
  const [research, field] = await Promise.all([
    supabaseRest<ResearchEvidence[]>("gh_research_evidence?select=id,project_id,response_id,media_asset_id,media_kind,mime_type,byte_size,sha256,scan_status,verification_status,captured_at,geo_unit_id,uploaded_by,created_at&order=created_at.desc&limit=150"),
    supabaseRest<FieldEvidence[]>("gh_field_report_evidence?select=id,report_id,media_asset_id,sha256,scan_status,verification_status,geo_unit_id,uploaded_by,created_at&order=created_at.desc&limit=150"),
  ])
  if (!research.ok || !field.ok) return NextResponse.json({ ok: false, error: "EVIDENCE_QUEUE_UNAVAILABLE" }, { status: 503, headers: noStore })
  return NextResponse.json({ ok: true, evidence: [...research.data.map(row => ({ ...row, evidence_type: "research" })), ...field.data.map(row => ({ ...row, evidence_type: "field_report" }))].sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))).slice(0,250) }, { headers: noStore })
}
export async function PATCH(request: Request) {
  const auth = await isAdmin(request)
  if (!auth) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403, headers: noStore })
  const parsed = await readBoundedJson(request, 4 * 1024)
  if (!parsed.ok) return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400, headers: noStore })
  const body = parsed.value as Record<string, unknown>
  const id = String(body.evidenceId || "")
  const type = String(body.evidenceType || "")
  const status = String(body.status || "")
  const note = typeof body.note === "string" ? body.note.trim().slice(0,1000) : ""
  if (!/^[0-9a-f-]{36}$/i.test(id) || !["research","field_report"].includes(type) || !["verified","rejected","quarantined"].includes(status)) return NextResponse.json({ ok: false, error: "INVALID_REVIEW" }, { status: 400, headers: noStore })
  const table = type === "research" ? "gh_research_evidence" : "gh_field_report_evidence"
  const current = await supabaseRest<Array<{ id: string; scan_status: string }>>(`${table}?id=eq.${id}&select=id,scan_status&limit=1`)
  if (!current.ok || !current.data.length) return NextResponse.json({ ok: false, error: "EVIDENCE_NOT_FOUND" }, { status: 404, headers: noStore })
  if (status === "verified" && current.data[0].scan_status !== "clean") return NextResponse.json({ ok: false, error: "EVIDENCE_NOT_SECURITY_CLEARED" }, { status: 409, headers: noStore })
  const updated = await supabaseRest<Array<Record<string, unknown>>>(`${table}?id=eq.${id}&select=id,verification_status,reviewed_by,reviewed_at,review_note,scan_status`, { method: "PATCH", headers: { "Content-Type": "application/json", Prefer: "return=representation" }, body: JSON.stringify({ verification_status: status, reviewed_by: auth.userId, reviewed_at: new Date().toISOString(), review_note: note || null }) })
  if (!updated.ok || !updated.data.length) return NextResponse.json({ ok: false, error: "EVIDENCE_REVIEW_FAILED" }, { status: 503, headers: noStore })
  return NextResponse.json({ ok: true, evidence: updated.data[0] }, { headers: noStore })
}
