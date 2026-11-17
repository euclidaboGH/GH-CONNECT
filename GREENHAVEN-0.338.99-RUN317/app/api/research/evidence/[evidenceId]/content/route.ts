import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { readGhcServerEnv } from "@/lib/server/economy/env"
import { supabaseRest } from "@/lib/server/supabase/rest-client"
import { checkDurableRateLimit, durableRateLimitCode, durableRateLimitStatus } from "@/lib/server/security/control-plane"
export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export async function GET(request: Request, context: { params: Promise<{ evidenceId: string }> }) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: { "Cache-Control": "no-store" } })
  const rate = await checkDurableRateLimit(`research-evidence-content:${auth.userId}`, 60, 60_000, { onUnavailable: "deny" })
  if (!rate.ok) return NextResponse.json({ ok: false, error: durableRateLimitCode(rate) }, { status: durableRateLimitStatus(rate), headers: { "Cache-Control": "no-store" } })
  const { evidenceId } = await context.params
  if (!/^[0-9a-f-]{36}$/i.test(evidenceId)) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 })
  const row = await supabaseRest<Array<Record<string, unknown>>>(`gh_research_evidence?id=eq.${evidenceId}&select=id,project_id,storage_bucket,object_path,verification_status,scan_status&limit=1`)
  const evidence = row.ok ? row.data[0] : null
  if (!evidence || evidence.scan_status !== "clean" || ["rejected", "quarantined"].includes(String(evidence.verification_status))) return NextResponse.json({ ok: false, error: "EVIDENCE_QUARANTINED" }, { status: 423, headers: { "Cache-Control": "no-store" } })
  const owner = await supabaseRest<Array<{ id: string }>>(`gh_research_projects?id=eq.${encodeURIComponent(String(evidence.project_id))}&owner_user_id=eq.${encodeURIComponent(auth.userId)}&select=id&limit=1`)
  const isCentralAdmin = Boolean(String(process.env.GHC_FIELD_ADMIN_USER_ID || "").trim() && auth.userId === String(process.env.GHC_FIELD_ADMIN_USER_ID || "").trim())
  if ((!owner.ok || !owner.data.length) && !isCentralAdmin) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404, headers: { "Cache-Control": "no-store" } })
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return NextResponse.json({ ok: false, error: "STORAGE_UNAVAILABLE" }, { status: 503 })
  const bucket = encodeURIComponent(String(evidence.storage_bucket))
  const path = String(evidence.object_path).split("/").map(encodeURIComponent).join("/")
  if (!path || path.startsWith("/") || path.split("/").some((p) => p === "..")) return NextResponse.json({ ok: false, error: "INVALID_STORAGE_PATH" }, { status: 503 })
  const signed = await fetch(`${env.supabaseUrl.replace(/\/$/, "")}/storage/v1/object/sign/${bucket}/${path}`, { method: "POST", headers: { apikey: env.supabaseServiceRoleKey, Authorization: `Bearer ${env.supabaseServiceRoleKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ expiresIn: 180 }), cache: "no-store", signal: AbortSignal.timeout(8_000) })
  const payload = await signed.json().catch(() => null) as { signedURL?: string; signedUrl?: string } | null
  const candidate = payload?.signedURL || payload?.signedUrl
  if (!signed.ok || !candidate) return NextResponse.json({ ok: false, error: "EVIDENCE_SIGNING_FAILED" }, { status: 503, headers: { "Cache-Control": "no-store" } })
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
