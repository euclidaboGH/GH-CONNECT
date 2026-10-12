/**
 * GET /api/social/link-preview?url=
 * Server-fetched Open Graph style metadata for compose. Analytics-free; never awards GHC.
 * Client must not trust arbitrary client-supplied title/description for ranking.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ALLOWED = /^https:\/\//i

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }
  const rl = checkRateLimit(`link-preview:${auth.userId}`, 20, 60_000)
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 })
  }

  const url = new URL(request.url)
  const target = String(url.searchParams.get("url") || "").trim()
  if (!target || target.length > 2000 || !ALLOWED.test(target)) {
    return NextResponse.json({ ok: false, error: "INVALID_URL" }, { status: 400 })
  }
  // Block obvious non-http and credentialed URLs
  try {
    const u = new URL(target)
    if (u.protocol !== "https:") {
      return NextResponse.json({ ok: false, error: "HTTPS_ONLY" }, { status: 400 })
    }
    if (u.username || u.password) {
      return NextResponse.json({ ok: false, error: "INVALID_URL" }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_URL" }, { status: 400 })
  }

  try {
    const res = await fetch(target, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent": "GreenHavenLinkPreview/1.0",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout?.(8_000),
    })
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: "FETCH_FAILED" }, { status: 502 })
    }
    const ct = res.headers.get("content-type") || ""
    if (!ct.includes("text/html") && !ct.includes("application/xhtml")) {
      return NextResponse.json({
        ok: true,
        url: target,
        title: null,
        description: null,
        image: null,
      })
    }
    const html = (await res.text()).slice(0, 200_000)
    const meta = (property: string) => {
      const re = new RegExp(
        `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`,
        "i"
      )
      const re2 = new RegExp(
        `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`,
        "i"
      )
      const m = html.match(re) || html.match(re2)
      return m ? m[1].trim().slice(0, 300) : null
    }
    const titleTag = html.match(/<title[^>]*>([^<]{1,200})<\/title>/i)
    return NextResponse.json({
      ok: true,
      url: target,
      title: meta("og:title") || meta("twitter:title") || (titleTag ? titleTag[1].trim() : null),
      description: meta("og:description") || meta("description"),
      image: meta("og:image") || meta("twitter:image"),
      // Explicit: previews never grant rewards or ranking score
      awardsValue: false,
    })
  } catch {
    return NextResponse.json({ ok: false, error: "FETCH_FAILED" }, { status: 502 })
  }
}
