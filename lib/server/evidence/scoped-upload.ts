import { createHash, randomBytes, randomUUID } from "node:crypto"
import { readGhcServerEnv } from "@/lib/server/economy/env"
import { ensureMediaBucket } from "@/lib/server/media/ensure-bucket"
import { buildOwnedMediaPath, isSafeMediaBucket, maxMediaBytesForMime } from "@/lib/server/media/path-policy.mjs"
import { createMediaAssetRecord } from "@/lib/server/media/asset-store"
import { evidenceSignatureMatches } from "@/lib/server/evidence/file-signature.mjs"
import { getServiceSupabaseConfig, supabaseRest } from "@/lib/server/supabase/rest-client"

export const EVIDENCE_MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif",
  "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov",
  "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/aac": "aac", "audio/ogg": "ogg", "audio/wav": "wav", "audio/webm": "webm", "audio/flac": "flac",
  "application/pdf": "pdf",
}

export type EvidenceScope = { scopeType: "research_response"; projectId: string; submissionKey: string; uploaderLabel?: string; geoUnitId?: string | null; requirePollingUnit?: boolean } | { scopeType: "field_report"; reportId: string; fieldSessionJti: string; uploaderLabel?: string; geoUnitId?: string | null; requirePollingUnit?: boolean }

export function evidenceTokenHash(token: string) { return createHash("sha256").update(token).digest("hex") }

export function evidenceKind(mime: string): "image" | "video" | "audio" | "document" | null {
  if (mime.startsWith("image/")) return "image"
  if (mime.startsWith("video/")) return "video"
  if (mime.startsWith("audio/")) return "audio"
  if (mime === "application/pdf") return "document"
  return null
}

export async function createScopedEvidenceUpload(input: EvidenceScope & { mimeType: string; byteSize: number; fileName?: string }) {
  if (!getServiceSupabaseConfig()) return { ok: false as const, status: 503, error: "EVIDENCE_STORAGE_UNAVAILABLE" }
  const mime = input.mimeType.toLowerCase().trim()
  const extension = EVIDENCE_MIME_EXTENSIONS[mime]
  const kind = evidenceKind(mime)
  const maxBytes = Math.min(maxMediaBytesForMime(mime), 50 * 1024 * 1024)
  if (!extension || !kind || !Number.isSafeInteger(input.byteSize) || input.byteSize < 1 || input.byteSize > maxBytes) {
    return { ok: false as const, status: 400, error: input.byteSize > maxBytes ? "FILE_TOO_LARGE" : "UNSUPPORTED_FILE_TYPE" }
  }
  if (input.geoUnitId) {
    const geo = await supabaseRest<Array<{ id: string; level_key: string }>>(`gh_research_geo_units?id=eq.${encodeURIComponent(input.geoUnitId)}&is_active=eq.true&select=id,level_key&limit=1`)
    if (!geo.ok || !geo.data.length || (input.requirePollingUnit && geo.data[0].level_key !== "polling_unit")) return { ok: false as const, status: 400, error: input.requirePollingUnit ? "POLLING_UNIT_NOT_VALIDATED" : "GEOGRAPHIC_UNIT_NOT_FOUND" }
  }
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return { ok: false as const, status: 503, error: "EVIDENCE_STORAGE_UNAVAILABLE" }
  const bucket = String(process.env.GH_MEDIA_BUCKET || "gh-media").trim() || "gh-media"
  if (!isSafeMediaBucket(bucket)) return { ok: false as const, status: 503, error: "MEDIA_BUCKET_INVALID" }
  if (input.scopeType === "research_response") {
    const existing = await supabaseRest<Array<{ id: string }>>(`gh_scoped_evidence_uploads?project_id=eq.${input.projectId}&submission_key=eq.${encodeURIComponent(input.submissionKey)}&status=in.(issued,quarantined,attached)&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=id&limit=5`)
    if (!existing.ok) return { ok: false as const, status: 503, error: "EVIDENCE_SESSION_CHECK_FAILED" }
    if (existing.data.length >= 5) return { ok: false as const, status: 429, error: "EVIDENCE_FILE_LIMIT_REACHED" }
  } else {
    const existing = await supabaseRest<Array<{ id: string }>>(`gh_scoped_evidence_uploads?report_id=eq.${input.reportId}&status=in.(issued,quarantined,attached)&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=id&limit=10`)
    if (!existing.ok) return { ok: false as const, status: 503, error: "EVIDENCE_SESSION_CHECK_FAILED" }
    if (existing.data.length >= 10) return { ok: false as const, status: 429, error: "EVIDENCE_FILE_LIMIT_REACHED" }
  }
  const uploadId = randomUUID()
  const uploadIdentity = uploadId.replace(/-/g, "")
  const token = randomBytes(32).toString("base64url")
  const tokenHash = evidenceTokenHash(token)
  const ownerId = input.scopeType === "research_response" ? `research_${input.projectId.replace(/-/g, "")}_${uploadIdentity}` : `field_${input.fieldSessionJti}_${uploadIdentity}`
  const category = kind === "image" ? "images" : kind === "video" ? "videos" : kind === "audio" ? "audio" : "documents"
  const objectName = `${randomUUID()}.${extension}`
  const objectPath = buildOwnedMediaPath(ownerId, category, objectName)
  if (!objectPath) return { ok: false as const, status: 400, error: "EVIDENCE_PATH_INVALID" }
  const expiresAt = new Date(Date.now() + 60 * 60_000).toISOString()
  const row = {
    id: uploadId,
    scope_type: input.scopeType,
    project_id: input.scopeType === "research_response" ? input.projectId : null,
    report_id: input.scopeType === "field_report" ? input.reportId : null,
    submission_key: input.scopeType === "research_response" ? input.submissionKey : null,
    field_session_jti: input.scopeType === "field_report" ? input.fieldSessionJti : null,
    uploader_label: (input.uploaderLabel || "Respondent").slice(0, 40),
    geo_unit_id: input.geoUnitId || null,
    owner_media_id: ownerId,
    bucket,
    storage_path: objectPath,
    mime_type: mime,
    byte_size: input.byteSize,
    token_hash: tokenHash,
    status: "issued",
    expires_at: expiresAt,
    metadata: { original_name: String(input.fileName || "evidence").replace(/[\\/\u0000-\u001f]/g, "_").slice(0, 120), client_mime: mime },
  }
  const saved = await supabaseRest<Array<{ id: string }>>("gh_scoped_evidence_uploads?select=id", { method: "POST", headers: { "Content-Type": "application/json", Prefer: "return=representation" }, body: JSON.stringify(row), timeoutMs: 10_000 })
  if (!saved.ok || !saved.data?.length) return { ok: false as const, status: 503, error: "EVIDENCE_SESSION_CREATE_FAILED" }
  const bucketReady = await ensureMediaBucket(bucket)
  if (!bucketReady.ok) {
    await supabaseRest(`gh_scoped_evidence_uploads?id=eq.${uploadId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "failed" }) })
    return { ok: false as const, status: 503, error: "EVIDENCE_BUCKET_UNAVAILABLE" }
  }
  const base = env.supabaseUrl.replace(/\/$/, "")
  const sign = await fetch(`${base}/storage/v1/object/upload/sign/${bucket}/${objectPath.split("/").map(encodeURIComponent).join("/")}`, {
    method: "POST", headers: { apikey: env.supabaseServiceRoleKey, Authorization: `Bearer ${env.supabaseServiceRoleKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({}), cache: "no-store", signal: AbortSignal.timeout(12_000),
  })
  const signData = await sign.json().catch(() => null) as { url?: string; token?: string } | null
  if (!sign.ok || !signData?.url) {
    await supabaseRest(`gh_scoped_evidence_uploads?id=eq.${uploadId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "failed" }) })
    return { ok: false as const, status: 503, error: "SIGNED_UPLOAD_UNAVAILABLE" }
  }
  const relativeUploadPath = signData.url.startsWith("/storage/v1/") ? signData.url : `/storage/v1${signData.url.startsWith("/") ? "" : "/"}${signData.url}`
  const uploadUrl = signData.url.startsWith("https://") ? signData.url : `${base}${relativeUploadPath}`
  const parsed = new URL(uploadUrl)
  if (parsed.protocol !== "https:" || parsed.origin !== new URL(base).origin || !parsed.pathname.startsWith("/storage/v1/object/upload/sign/")) {
    await supabaseRest(`gh_scoped_evidence_uploads?id=eq.${uploadId}&status=eq.issued`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "failed" }) })
    return { ok: false as const, status: 502, error: "SIGNED_UPLOAD_UNTRUSTED" }
  }
  return { ok: true as const, uploadId, token, uploadUrl, uploadToken: signData.token || null, objectPath, bucket, mimeType: mime, kind, maxBytes, expiresAt }
}


export async function finalizeScopedEvidenceUpload(input: { uploadId: string; token: string; expectedScope: "research_response" | "field_report"; scopeId: string; sessionJti?: string }) {
  if (!getServiceSupabaseConfig()) return { ok: false as const, status: 503, error: "EVIDENCE_STORAGE_UNAVAILABLE" }
  const tokenHash = evidenceTokenHash(input.token)
  const session = await supabaseRest<Array<Record<string, unknown>>>(`gh_scoped_evidence_uploads?id=eq.${input.uploadId}&token_hash=eq.${tokenHash}&scope_type=eq.${input.expectedScope}&select=*&limit=1`)
  const row = session.ok ? session.data[0] : null
  if (!row || new Date(String(row.expires_at)).getTime() <= Date.now()) return { ok: false as const, status: 404, error: "UPLOAD_SESSION_INVALID_OR_EXPIRED" }
  if (input.expectedScope === "research_response" && String(row.project_id) !== input.scopeId) return { ok: false as const, status: 403, error: "UPLOAD_SCOPE_MISMATCH" }
  if (input.expectedScope === "field_report" && (String(row.report_id) !== input.scopeId || String(row.field_session_jti) !== String(input.sessionJti || ""))) return { ok: false as const, status: 403, error: "UPLOAD_SCOPE_MISMATCH" }
  if (row.status === "quarantined" && row.media_asset_id) {
    const table = input.expectedScope === "research_response" ? "gh_research_evidence" : "gh_field_report_evidence"
    const scopeFilter = input.expectedScope === "research_response" ? `project_id=eq.${input.scopeId}` : `report_id=eq.${input.scopeId}`
    const existing = await supabaseRest<Array<{ id: string; sha256: string; scan_status: string; verification_status: string }>>(`${table}?media_asset_id=eq.${encodeURIComponent(String(row.media_asset_id))}&${scopeFilter}&select=id,sha256,scan_status,verification_status&limit=1`)
    if (existing.ok && existing.data.length) return { ok: true as const, evidenceId: String(existing.data[0].id), sha256: String(existing.data[0].sha256 || row.sha256 || ""), scanStatus: existing.data[0].scan_status, verificationStatus: existing.data[0].verification_status, idempotent: true }
  }
  if (row.status !== "issued") return { ok: false as const, status: 409, error: "UPLOAD_SESSION_ALREADY_FINALIZED" }
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return { ok: false as const, status: 503, error: "EVIDENCE_STORAGE_UNAVAILABLE" }
  const base = env.supabaseUrl.replace(/\/$/, "")
  const objectUrl = `${base}/storage/v1/object/${encodeURIComponent(String(row.bucket))}/${String(row.storage_path).split("/").map(encodeURIComponent).join("/")}`
  const response = await fetch(objectUrl, { headers: { apikey: env.supabaseServiceRoleKey, Authorization: `Bearer ${env.supabaseServiceRoleKey}` }, cache: "no-store", signal: AbortSignal.timeout(30_000) })
  if (!response.ok || !response.body) return { ok: false as const, status: 409, error: "UPLOADED_OBJECT_NOT_FOUND" }
  const hash = createHash("sha256")
  let total = 0
  let first = Buffer.alloc(0)
  const reader = response.body.getReader()
  try {
    while (true) {
      const part = await reader.read()
      if (part.done) break
      const chunk = Buffer.from(part.value)
      total += chunk.length
      if (total > Number(row.byte_size)) { await reader.cancel(); return { ok: false as const, status: 409, error: "UPLOADED_OBJECT_SIZE_MISMATCH" } }
      if (first.length < 32) first = Buffer.concat([first, chunk.subarray(0, 32 - first.length)])
      hash.update(chunk)
    }
  } finally { reader.releaseLock() }
  if (total !== Number(row.byte_size) || !evidenceSignatureMatches(String(row.mime_type), first)) return { ok: false as const, status: 409, error: "FILE_SIGNATURE_OR_SIZE_INVALID" }
  const sha256 = hash.digest("hex")
  const mediaKind = String(row.mime_type).startsWith("image/") ? "image" : String(row.mime_type).startsWith("video/") ? "video" : "file"
  const mediaId = `media_${input.uploadId.slice(0, 8)}_${input.uploadId.replace(/-/g, "")}`
  const media = await createMediaAssetRecord({ id: mediaId, ownerId: String(row.owner_media_id), bucket: String(row.bucket), storagePath: String(row.storage_path), mediaKind, mimeType: String(row.mime_type), byteSize: total, metadata: { source: "scoped_evidence_upload", evidence_sha256: sha256, quarantine: true } })
  if (!media.ok || !media.id) return { ok: false as const, status: 503, error: "MEDIA_ASSET_RECORD_FAILED" }
  const now = new Date().toISOString()
  if (input.expectedScope === "research_response") {
    const saved = await supabaseRest<Array<Record<string, unknown>>>("gh_research_evidence?on_conflict=storage_bucket,object_path&select=id", { method: "POST", headers: { "Content-Type": "application/json", Prefer: "return=representation,resolution=ignore-duplicates" }, body: JSON.stringify({ project_id: row.project_id, response_id: null, uploaded_by: "public_respondent", submission_key: row.submission_key, uploader_type: "public_respondent", uploader_session_id: row.id, storage_bucket: row.bucket, object_path: row.storage_path, media_asset_id: media.id, media_kind: String(row.mime_type).startsWith("image/") ? "image" : String(row.mime_type).startsWith("video/") ? "video" : String(row.mime_type).startsWith("audio/") ? "audio" : "document", mime_type: row.mime_type, byte_size: total, sha256, verification_status: "quarantined", scan_status: "pending", captured_at: null, geo_unit_id: row.geo_unit_id || null, metadata: { source: "public_respondent", original_name: (row.metadata as Record<string,string>)?.original_name || "evidence" } }) })
    if (!saved.ok) return { ok: false as const, status: 503, error: "EVIDENCE_RECORD_CREATE_FAILED" }
    const fallback = saved.data?.[0] ? null : await supabaseRest<Array<{ id: string }>>(`gh_research_evidence?media_asset_id=eq.${encodeURIComponent(media.id)}&project_id=eq.${row.project_id}&select=id&limit=1`)
    const evidenceRow = saved.data?.[0] || (fallback?.ok ? fallback.data[0] : undefined)
    if (!evidenceRow?.id) return { ok: false as const, status: 503, error: "EVIDENCE_RECORD_CREATE_FAILED" }
    await supabaseRest(`gh_scoped_evidence_uploads?id=eq.${input.uploadId}&status=eq.issued`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "quarantined", sha256, media_asset_id: media.id, completed_at: now }) })
    return { ok: true as const, evidenceId: String(evidenceRow.id), sha256, scanStatus: "pending", verificationStatus: "quarantined" }
  }
  const saved = await supabaseRest<Array<Record<string, unknown>>>("gh_field_report_evidence?on_conflict=report_id,media_asset_id&select=id", { method: "POST", headers: { "Content-Type": "application/json", Prefer: "return=representation,resolution=ignore-duplicates" }, body: JSON.stringify({ report_id: row.report_id, media_asset_id: media.id, uploaded_by: `field:${row.field_session_jti}`, caption: "", verification_status: "quarantined", scan_status: "pending", sha256, geo_unit_id: row.geo_unit_id || null, metadata: { source: "field_agent", upload_session_id: row.id } }) })
  if (!saved.ok) return { ok: false as const, status: 503, error: "EVIDENCE_RECORD_CREATE_FAILED" }
  const fallback = saved.data?.[0] ? null : await supabaseRest<Array<{ id: string }>>(`gh_field_report_evidence?media_asset_id=eq.${encodeURIComponent(media.id)}&report_id=eq.${row.report_id}&select=id&limit=1`)
  const evidenceRow = saved.data?.[0] || (fallback?.ok ? fallback.data[0] : undefined)
  if (!evidenceRow?.id) return { ok: false as const, status: 503, error: "EVIDENCE_RECORD_CREATE_FAILED" }
  await supabaseRest(`gh_scoped_evidence_uploads?id=eq.${input.uploadId}&status=eq.issued`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "quarantined", sha256, media_asset_id: media.id, completed_at: now }) })
  return { ok: true as const, evidenceId: String(evidenceRow.id), sha256, scanStatus: "pending", verificationStatus: "quarantined" }
}
