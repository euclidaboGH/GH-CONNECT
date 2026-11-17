import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { supabaseRest, getServiceSupabaseConfig } from "@/lib/server/supabase/rest-client"
import { readBoundedJson } from "@/lib/server/http/read-bounded-json"
export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const noStore = { "Cache-Control": "private, no-store", Vary: "Cookie, Authorization" }
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await resolveAuthenticatedUser(request.headers)
  const admin = String(process.env.GHC_FIELD_ADMIN_USER_ID || "").trim()
  if (!auth || !admin || auth.userId !== admin) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403, headers: noStore })
  const { id } = await context.params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404, headers: noStore })
  const report = await supabaseRest<Array<{ id: string }>>(`gh_field_reports?id=eq.${id}&select=id&limit=1`)
  if (!report.ok || !report.data.length) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404, headers: noStore })
  const rows = await supabaseRest<Array<Record<string, unknown>>>(`gh_field_report_evidence?report_id=eq.${id}&select=id,media_asset_id,caption,verification_status,scan_status,sha256,geo_unit_id,review_note,created_at&order=created_at.desc`)
  if (!rows.ok) return NextResponse.json({ ok: false, error: "EVIDENCE_UNAVAILABLE" }, { status: 503, headers: noStore })
  return NextResponse.json({ ok: true, evidence: rows.data }, { headers: noStore })
}
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await resolveAuthenticatedUser(request.headers)
  const admin = String(process.env.GHC_FIELD_ADMIN_USER_ID || "").trim()
  if (!auth || !admin || auth.userId !== admin) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403, headers: noStore })
  const parsed = await readBoundedJson(request, 4 * 1024)
  if (!parsed.ok) return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400, headers: noStore })
  const { id } = await context.params
  const body = parsed.value as Record<string, unknown>
  const mediaId = String(body.mediaId || "")
  const caption = typeof body.caption === "string" ? body.caption.trim().slice(0, 500) : ""
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^media_[a-z0-9]+_[a-z0-9]+$/i.test(mediaId) || !getServiceSupabaseConfig()) return NextResponse.json({ ok: false, error: "INVALID_EVIDENCE_REFERENCE" }, { status: 400, headers: noStore })
  const report = await supabaseRest<Array<{ id: string }>>(`gh_field_reports?id=eq.${id}&select=id&limit=1`)
  const asset = await supabaseRest<Array<Record<string, unknown>>>(`gh_media_assets?id=eq.${encodeURIComponent(mediaId)}&owner_id=eq.${encodeURIComponent(auth.userId)}&status=eq.ready&deleted_at=is.null&select=id&limit=1`)
  if (!report.ok || !report.data.length || !asset.ok || !asset.data.length) return NextResponse.json({ ok: false, error: "REPORT_OR_MEDIA_NOT_FOUND" }, { status: 404, headers: noStore })
  const saved = await supabaseRest<Array<Record<string, unknown>>>("gh_field_report_evidence?on_conflict=report_id,media_asset_id&select=id,report_id,media_asset_id,caption,verification_status,scan_status,created_at", { method: "POST", headers: { "Content-Type": "application/json", Prefer: "return=representation,resolution=ignore-duplicates" }, body: JSON.stringify({ report_id: id, media_asset_id: mediaId, uploaded_by: auth.userId, caption, verification_status: "quarantined", scan_status: "pending" }) })
  if (!saved.ok) return NextResponse.json({ ok: false, error: "EVIDENCE_ATTACH_FAILED" }, { status: 503, headers: noStore })
  if (!saved.data.length) return NextResponse.json({ ok: false, error: "EVIDENCE_ALREADY_ATTACHED" }, { status: 409, headers: noStore })
  return NextResponse.json({ ok: true, evidence: saved.data[0] }, { status: 201, headers: noStore })
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await resolveAuthenticatedUser(request.headers)
  const admin = String(process.env.GHC_FIELD_ADMIN_USER_ID || "").trim()
  if (!auth || !admin || auth.userId !== admin) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403, headers: noStore })
  const parsed = await readBoundedJson(request, 4 * 1024)
  if (!parsed.ok) return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400, headers: noStore })
  const { id } = await context.params
  const body = parsed.value as Record<string, unknown>
  const evidenceId = String(body.evidenceId || "")
  const status = String(body.status || "")
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 1000) : ""
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^[0-9a-f-]{36}$/i.test(evidenceId) || !["pending", "verified", "rejected", "quarantined"].includes(status)) return NextResponse.json({ ok: false, error: "INVALID_REVIEW" }, { status: 400, headers: noStore })
  const current = await supabaseRest<Array<{ scan_status: string }>>(`gh_field_report_evidence?id=eq.${evidenceId}&report_id=eq.${id}&select=scan_status&limit=1`)
  if (!current.ok || !current.data.length) return NextResponse.json({ ok: false, error: "EVIDENCE_NOT_FOUND" }, { status: 404, headers: noStore })
  if (status === "verified" && current.data[0].scan_status !== "clean") return NextResponse.json({ ok: false, error: "EVIDENCE_NOT_SECURITY_CLEARED" }, { status: 409, headers: noStore })
  const updated = await supabaseRest<Array<Record<string, unknown>>>(`gh_field_report_evidence?id=eq.${evidenceId}&report_id=eq.${id}&select=id,verification_status,review_note,reviewed_by,reviewed_at,scan_status`, { method: "PATCH", headers: { "Content-Type": "application/json", Prefer: "return=representation" }, body: JSON.stringify({ verification_status: status, review_note: note || null, reviewed_by: auth.userId, reviewed_at: new Date().toISOString() }) })
  if (!updated.ok || !updated.data.length) return NextResponse.json({ ok: false, error: "EVIDENCE_NOT_FOUND" }, { status: 404, headers: noStore })
  return NextResponse.json({ ok: true, evidence: updated.data[0] }, { headers: noStore })
}
