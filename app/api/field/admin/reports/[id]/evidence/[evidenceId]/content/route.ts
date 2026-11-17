import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { readGhcServerEnv } from "@/lib/server/economy/env"
import { supabaseRest } from "@/lib/server/supabase/rest-client"
import { checkDurableRateLimit, durableRateLimitCode, durableRateLimitStatus } from "@/lib/server/security/control-plane"
export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export async function GET(request: Request, context: { params: Promise<{ id: string; evidenceId: string }> }) {
  const auth = await resolveAuthenticatedUser(request.headers)
  const admin = String(process.env.GHC_FIELD_ADMIN_USER_ID || "").trim()
  if (!auth || !admin || auth.userId !== admin) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403, headers: { "Cache-Control": "no-store" } })
  const rate = await checkDurableRateLimit(`field-evidence-content:${auth.userId}`, 60, 60_000, { onUnavailable: "deny" })
  if (!rate.ok) return NextResponse.json({ ok: false, error: durableRateLimitCode(rate) }, { status: durableRateLimitStatus(rate), headers: { "Cache-Control": "no-store" } })
  const { id, evidenceId } = await context.params
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^[0-9a-f-]{36}$/i.test(evidenceId)) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 })
  const row = await supabaseRest<Array<{ media_asset_id: string; scan_status: string; verification_status: string }>>(`gh_field_report_evidence?id=eq.${evidenceId}&report_id=eq.${id}&select=media_asset_id,scan_status,verification_status&limit=1`)
  if (!row.ok || !row.data.length) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404, headers: { "Cache-Control": "no-store" } })
  if (row.data[0].scan_status !== "clean" || ["rejected", "quarantined"].includes(String(row.data[0].verification_status))) return NextResponse.json({ ok: false, error: "EVIDENCE_QUARANTINED" }, { status: 423, headers: { "Cache-Control": "no-store" } })
  const asset = await supabaseRest<Array<{ bucket: string; storage_path: string }>>(`gh_media_assets?id=eq.${encodeURIComponent(row.data[0].media_asset_id)}&status=eq.ready&deleted_at=is.null&select=bucket,storage_path&limit=1`)
  if (!asset.ok || !asset.data.length) return NextResponse.json({ ok: false, error: "MEDIA_NOT_FOUND" }, { status: 404 })
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return NextResponse.json({ ok: false, error: "STORAGE_UNAVAILABLE" }, { status: 503 })
  const { bucket, storage_path: storagePath } = asset.data[0]
  if (!storagePath || storagePath.startsWith("/") || storagePath.split("/").some((part) => !part || part === "." || part === "..")) return NextResponse.json({ ok: false, error: "INVALID_STORAGE_PATH" }, { status: 503 })
  const path = storagePath.split("/").map(encodeURIComponent).join("/")
  const signed = await fetch(`${env.supabaseUrl.replace(/\/$/, "")}/storage/v1/object/sign/${encodeURIComponent(bucket)}/${path}`, { method: "POST", headers: { apikey: env.supabaseServiceRoleKey, Authorization: `Bearer ${env.supabaseServiceRoleKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ expiresIn: 180 }), cache: "no-store", signal: AbortSignal.timeout(8_000) })
  const payload = await signed.json().catch(() => null) as { signedURL?: string; signedUrl?: string } | null
  const candidate = payload?.signedURL || payload?.signedUrl
  if (!signed.ok || !candidate) return NextResponse.json({ ok: false, error: "EVIDENCE_SIGNING_FAILED" }, { status: 503 })
  const storageBase = env.supabaseUrl.replace(/\/$/, "")
  const trustedOrigin = new URL(storageBase).origin
  let target: URL
  try {
    if (candidate.startsWith("https://")) target = new URL(candidate)
    else if (candidate.startsWith("/storage/v1/object/sign/")) target = new URL(candidate, storageBase)
    else if (candidate.startsWith("/object/sign/")) target = new URL(`/storage/v1${candidate}`, storageBase)
    else return NextResponse.json({ ok: false, error: "INVALID_SIGNED_URL" }, { status: 502 })
  } catch { return NextResponse.json({ ok: false, error: "INVALID_SIGNED_URL" }, { status: 502 }) }
  if (target.protocol !== "https:" || target.origin !== trustedOrigin || !target.pathname.includes("/object/sign/")) return NextResponse.json({ ok: false, error: "INVALID_SIGNED_URL" }, { status: 502 })
  return NextResponse.redirect(target.toString(), { status: 302, headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff", Vary: "Cookie, Authorization" } })
}
