import { NextResponse } from "next/server"
import { randomUUID } from "node:crypto"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkDurableRateLimit, durableRateLimitCode, durableRateLimitStatus } from "@/lib/server/security/control-plane"
import { readBoundedJson } from "@/lib/server/http/read-bounded-json"
import { getServiceSupabaseConfig, supabaseRest } from "@/lib/server/supabase/rest-client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie, Authorization" }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const mediaIdPattern = /^media_[a-z0-9]+_[a-z0-9]+$/i

async function ownedProject(projectId: string, ownerId: string) {
  return supabaseRest<Array<{ id: string }>>(`gh_research_projects?id=eq.${encodeURIComponent(projectId)}&owner_user_id=eq.${encodeURIComponent(ownerId)}&select=id&limit=1`)
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers })
  const rate = await checkDurableRateLimit(`research-evidence-list:${auth.userId}`, 60, 60_000, { onUnavailable: "deny" })
  if (!rate.ok) return NextResponse.json({ ok: false, error: durableRateLimitCode(rate) }, { status: durableRateLimitStatus(rate), headers })
  if (!getServiceSupabaseConfig()) return NextResponse.json({ ok: false, error: "STORAGE_UNAVAILABLE" }, { status: 503, headers })
  const { id } = await context.params
  if (!uuid.test(id)) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404, headers })
  const owner = await ownedProject(id, auth.userId)
  if (!owner.ok || !owner.data.length) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404, headers })
  const rows = await supabaseRest<Array<Record<string, unknown>>>(`gh_research_evidence?project_id=eq.${id}&select=id,response_id,media_asset_id,media_kind,mime_type,byte_size,sha256,scan_status,uploader_type,geo_unit_id,caption,verification_status,review_note,created_at&order=created_at.desc&limit=300`)
  if (!rows.ok) return NextResponse.json({ ok: false, error: "EVIDENCE_LIST_FAILED" }, { status: 503, headers })
  return NextResponse.json({ ok: true, evidence: rows.data }, { headers })
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers })
  const rate = await checkDurableRateLimit(`research-evidence-add:${auth.userId}`, 40, 60_000, { onUnavailable: "deny" })
  if (!rate.ok) return NextResponse.json({ ok: false, error: durableRateLimitCode(rate) }, { status: durableRateLimitStatus(rate), headers })
  const parsed = await readBoundedJson(request, 8 * 1024)
  if (!parsed.ok) return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: parsed.error === "REQUEST_TOO_LARGE" ? 413 : 400, headers })
  const { id: projectId } = await context.params
  if (!uuid.test(projectId) || !getServiceSupabaseConfig()) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404, headers })
  const owner = await ownedProject(projectId, auth.userId)
  if (!owner.ok || !owner.data.length) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404, headers })
  const body = parsed.value as Record<string, unknown>
  const mediaId = String(body.mediaId || "")
  const responseId = body.responseId == null || body.responseId === "" ? null : String(body.responseId)
  const caption = typeof body.caption === "string" ? body.caption.trim().slice(0, 500) : ""
  if (!mediaIdPattern.test(mediaId) || (responseId && !uuid.test(responseId))) return NextResponse.json({ ok: false, error: "INVALID_EVIDENCE_REFERENCE" }, { status: 400, headers })
  if (responseId) {
    const response = await supabaseRest<Array<{ id: string }>>(`gh_research_responses?id=eq.${responseId}&project_id=eq.${projectId}&select=id&limit=1`)
    if (!response.ok || !response.data.length) return NextResponse.json({ ok: false, error: "RESPONSE_NOT_FOUND" }, { status: 404, headers })
  }
  const asset = await supabaseRest<Array<Record<string, unknown>>>(`gh_media_assets?id=eq.${encodeURIComponent(mediaId)}&owner_id=eq.${encodeURIComponent(auth.userId)}&status=eq.ready&deleted_at=is.null&select=id,owner_id,bucket,storage_path,media_kind,mime_type,byte_size&limit=1`)
  const media = asset.ok ? asset.data[0] : null
  if (!media || !media.bucket || !media.storage_path) return NextResponse.json({ ok: false, error: "MEDIA_NOT_OWNED_OR_READY" }, { status: 404, headers })
  const mime = String(media.mime_type || "application/octet-stream")
  const mediaKind = mime.startsWith("image/") ? "image" : mime.startsWith("video/") ? "video" : mime.startsWith("audio/") ? "audio" : "document"
  const saved = await supabaseRest<Array<Record<string, unknown>>>("gh_research_evidence?on_conflict=storage_bucket,object_path&select=id,project_id,response_id,media_asset_id,media_kind,mime_type,byte_size,caption,verification_status,created_at", {
    method: "POST", headers: { "Content-Type": "application/json", Prefer: "return=representation,resolution=ignore-duplicates" },
    body: JSON.stringify({ id: randomUUID(), project_id: projectId, response_id: responseId, uploaded_by: auth.userId, storage_bucket: media.bucket, object_path: media.storage_path, media_asset_id: media.id, media_kind: mediaKind, mime_type: mime, byte_size: Number(media.byte_size), caption, verification_status: "quarantined", scan_status: "pending", uploader_type: "owner", metadata: { source: "research_studio", media_asset_id: media.id } }), timeoutMs: 12_000,
  })
  if (!saved.ok) return NextResponse.json({ ok: false, error: "EVIDENCE_ATTACH_FAILED" }, { status: 503, headers })
  const evidence = saved.data[0]
  if (!evidence) return NextResponse.json({ ok: false, error: "EVIDENCE_ALREADY_ATTACHED" }, { status: 409, headers })
  await supabaseRest("gh_research_audit_events", { method: "POST", headers: { "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ project_id: projectId, actor_user_id: auth.userId, action: "evidence.attached", target_type: "research_evidence", target_id: evidence.id, details: { media_kind: mediaKind, response_id: responseId } }) })
  return NextResponse.json({ ok: true, evidence }, { status: 201, headers })
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers })
  const rate = await checkDurableRateLimit(`research-evidence-review:${auth.userId}`, 60, 60_000, { onUnavailable: "deny" })
  if (!rate.ok) return NextResponse.json({ ok: false, error: durableRateLimitCode(rate) }, { status: durableRateLimitStatus(rate), headers })
  const parsed = await readBoundedJson(request, 4 * 1024)
  if (!parsed.ok) return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400, headers })
  const { id: projectId } = await context.params
  const body = parsed.value as Record<string, unknown>
  const evidenceId = String(body.evidenceId || "")
  const status = String(body.status || "")
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 1000) : ""
  if (!uuid.test(projectId) || !uuid.test(evidenceId) || !["verified", "rejected", "quarantined", "pending"].includes(status)) return NextResponse.json({ ok: false, error: "INVALID_REVIEW" }, { status: 400, headers })
  const owner = await ownedProject(projectId, auth.userId)
  if (!owner.ok || !owner.data.length) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404, headers })
  const current = await supabaseRest<Array<{ scan_status: string }>>(`gh_research_evidence?id=eq.${evidenceId}&project_id=eq.${projectId}&select=scan_status&limit=1`)
  if (!current.ok || !current.data.length) return NextResponse.json({ ok: false, error: "EVIDENCE_NOT_FOUND" }, { status: 404, headers })
  if (status === "verified" && current.data[0].scan_status !== "clean") return NextResponse.json({ ok: false, error: "EVIDENCE_NOT_SECURITY_CLEARED" }, { status: 409, headers })
  const updated = await supabaseRest<Array<Record<string, unknown>>>(`gh_research_evidence?id=eq.${evidenceId}&project_id=eq.${projectId}&select=id,verification_status,reviewed_by,reviewed_at,review_note,scan_status`, { method: "PATCH", headers: { "Content-Type": "application/json", Prefer: "return=representation" }, body: JSON.stringify({ verification_status: status, reviewed_by: auth.userId, reviewed_at: new Date().toISOString(), review_note: note || null }) })
  if (!updated.ok || !updated.data.length) return NextResponse.json({ ok: false, error: "EVIDENCE_NOT_FOUND" }, { status: 404, headers })
  await supabaseRest("gh_research_audit_events", { method: "POST", headers: { "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ project_id: projectId, actor_user_id: auth.userId, action: `evidence.${status}`, target_type: "research_evidence", target_id: evidenceId, details: { note } }) })
  return NextResponse.json({ ok: true, evidence: updated.data[0] }, { headers })
}
