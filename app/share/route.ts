/**
 * /share — Web Share Target (see public/manifest.json `share_target`).
 *
 * POST (multipart) arrives from the OS share sheet. Shared files are NOT stored
 * or processed; only title/text/url are read, length-capped, and forwarded to
 * the app shell via query params. GET is accepted for browsers that share via GET.
 * Always responds with a redirect so the user lands in the app.
 */
import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function capped(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : ""
}

function redirectHome(request: Request, title: string, text: string, url: string) {
  const dest = new URL("/", request.url)
  dest.searchParams.set("tab", "home")
  dest.searchParams.set("share", "1")
  if (title) dest.searchParams.set("share_title", title)
  if (text) dest.searchParams.set("share_text", text)
  if (url) dest.searchParams.set("share_url", url)
  // 303 so the browser follows with GET after a POST
  return NextResponse.redirect(dest, 303)
}

export async function POST(request: Request) {
  try {
    const form = await request.formData()
    return redirectHome(
      request,
      capped(form.get("title"), 120),
      capped(form.get("text"), 500),
      capped(form.get("url"), 500)
    )
  } catch {
    return NextResponse.redirect(new URL("/", request.url), 303)
  }
}

export async function GET(request: Request) {
  const p = new URL(request.url).searchParams
  return redirectHome(request, capped(p.get("title"), 120), capped(p.get("text"), 500), capped(p.get("url"), 500))
}
