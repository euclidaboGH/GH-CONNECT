/**
 * GET /api/media/:id/signed-url
 * Issues a short-lived URL only after database authorization for the actual session viewer.
 * The service-role key never leaves the server; responses are never cacheable.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { readGhcServerEnv } from "@/lib/server/economy/env"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function reply(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache", Vary: "Cookie, Authorization" } })
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return reply({ ok: false, error: "AUTH_REQUIRED" }, 401)

  const limit = checkRateLimit(`media-sign:${auth.userId}`, 60, 60_000)
  if (!limit.ok) return reply({ ok: false, error: "RATE_LIMITED" }, 429)

  const { id } = await context.params
  if (!/^media_[a-z0-9]+_[a-z0-9]+$/i.test(id) || id.length > 100) {
    return reply({ ok: false, error: "INVALID_MEDIA_ID" }, 400)
  }

  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    return reply({ ok: false, error: "MEDIA_STORAGE_UNAVAILABLE" }, 503)
  }

  try {
    const base = env.supabaseUrl.replace(/\/$/, "")
    // Authorization is against the actual session viewer and current post visibility,
    // not merely the media owner. Unknown and unauthorized IDs share a 404 response.
    const authz = await fetch(`${base}/rest/v1/rpc/gh_media_authorize_viewer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: env.supabaseServiceRoleKey,
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
      },
      body: JSON.stringify({ p_media_id: id, p_viewer_id: auth.userId }),
      cache: "no-store",
    })
    if (!authz.ok) return reply({ ok: false, error: "MEDIA_AUTHORIZATION_UNAVAILABLE" }, 503)
    const asset = await authz.json() as {
      ok?: boolean; error?: string; mediaId?: string; ownerId?: string;
      bucket?: string; storagePath?: string; mime?: string; kind?: string;
    }
    if (!asset || asset.ok !== true || asset.mediaId !== id || !asset.ownerId || !asset.bucket || !asset.storagePath) {
      return reply({ ok: false, error: "MEDIA_NOT_FOUND" }, 404)
    }
    if (!asset.storagePath.startsWith(`${asset.ownerId}/`) || asset.storagePath.includes("..")) {
      return reply({ ok: false, error: "MEDIA_RECORD_INVALID" }, 503)
    }

    const bucket = encodeURIComponent(asset.bucket)
    const objectPath = asset.storagePath.split("/").map(encodeURIComponent).join("/")
    const signed = await fetch(`${base}/storage/v1/object/sign/${bucket}/${objectPath}`, {
      method: "POST",
      headers: { apikey: env.supabaseServiceRoleKey, Authorization: `Bearer ${env.supabaseServiceRoleKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn: 300 }),
      cache: "no-store",
    })
    if (!signed.ok) return reply({ ok: false, error: "MEDIA_SIGNING_UNAVAILABLE" }, 503)
    const payload = await signed.json() as { signedURL?: string; signedUrl?: string }
    const relative = payload.signedURL || payload.signedUrl
    if (typeof relative !== "string" || !relative.startsWith("/storage/v1/object/sign/")) {
      return reply({ ok: false, error: "MEDIA_SIGNING_INVALID_RESPONSE" }, 502)
    }
    return reply({ ok: true, mediaId: asset.mediaId, url: `${base}${relative}`, expiresIn: 300, mime: asset.mime })
  } catch {
    return reply({ ok: false, error: "MEDIA_SIGNING_UNAVAILABLE" }, 503)
  }
}
