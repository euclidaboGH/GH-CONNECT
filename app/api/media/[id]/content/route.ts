/**
 * GET /api/media/:id/content
 * Viewer-authorized media delivery facade. The signed-url endpoint re-checks the
 * actual session actor against current post visibility and issues a short-lived URL.
 * Possession of a media ID alone never grants access.
 */
import { NextResponse } from "next/server"
import { readGhcServerEnv } from "@/lib/server/economy/env"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function reply(status: number, error: string) {
  return NextResponse.json({ ok: false, error }, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      Pragma: "no-cache",
      "X-Content-Type-Options": "nosniff",
      Vary: "Cookie, Authorization",
    },
  })
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  if (!/^media_[a-z0-9]+_[a-z0-9]+$/i.test(id) || id.length > 100) return reply(400, "INVALID_MEDIA_ID")
  // Never derive an authenticated server-side fetch destination from the incoming
  // Host/Forwarded headers. Use the deployment's configured canonical origin so
  // a spoofed host cannot receive forwarded session cookies or Authorization.
  const configuredAppUrl = String(process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || "").trim()
  const normalizedAppUrl = configuredAppUrl
    ? (/^https?:\/\//i.test(configuredAppUrl) ? configuredAppUrl : `https://${configuredAppUrl}`)
    : (process.env.NODE_ENV !== "production" ? "http://localhost:3000" : "")
  let appOrigin = ""
  try {
    const configured = normalizedAppUrl ? new URL(normalizedAppUrl) : null
    if (configured && (configured.protocol === "https:" || (process.env.NODE_ENV !== "production" && configured.protocol === "http:" && ["localhost", "127.0.0.1"].includes(configured.hostname)))) {
      appOrigin = configured.origin
    }
  } catch {
    appOrigin = ""
  }
  if (!appOrigin) return reply(503, "APP_ORIGIN_NOT_CONFIGURED")

  try {
    const signedResponse = await fetch(`${appOrigin}/api/media/${encodeURIComponent(id)}/signed-url`, {
      method: "GET",
      headers: {
        ...(request.headers.get("cookie") ? { cookie: request.headers.get("cookie")! } : {}),
        ...(request.headers.get("authorization") ? { authorization: request.headers.get("authorization")! } : {}),
      },
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(8_000),
    })
    const payload = await signedResponse.json().catch(() => null) as { ok?: boolean; url?: string; error?: string } | null
    if (!signedResponse.ok || !payload?.ok || typeof payload.url !== "string") {
      const status = signedResponse.status >= 400 && signedResponse.status < 500 ? signedResponse.status : 503
      return reply(status, payload?.error || "MEDIA_DELIVERY_UNAVAILABLE")
    }
    const signed = new URL(payload.url)
    const env = readGhcServerEnv()
    if (!env.supabaseUrl) return reply(503, "MEDIA_STORAGE_UNAVAILABLE")
    const trustedStorageOrigin = new URL(env.supabaseUrl).origin
    if (signed.protocol !== "https:" || signed.origin !== trustedStorageOrigin) return reply(502, "MEDIA_SIGNING_INVALID_RESPONSE")
    return NextResponse.redirect(signed.toString(), {
      status: 302,
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        Pragma: "no-cache",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
        Vary: "Cookie, Authorization",
      },
    })
  } catch {
    return reply(503, "MEDIA_DELIVERY_UNAVAILABLE")
  }
}
