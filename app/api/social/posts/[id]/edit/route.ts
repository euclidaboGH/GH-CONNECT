/**
 * PATCH /api/social/posts/[id]/edit — edit own post content + optional media.
 * POST is accepted as an alias (same handler) so older clients do not get 405.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { socialDbConfigured } from "@/lib/server/social/rpc"
import { readGhcServerEnv } from "@/lib/server/economy/env"
import { nonDurableWriteResponse } from "@/lib/server/production-guard"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

function isSafeImageRef(url: string): boolean {
  if (!url || typeof url !== "string") return false
  if (url.startsWith("blob:")) return false
  if (url.startsWith("data:image/")) return url.length < 2_500_000
  if (url.startsWith("https://")) return url.length < 2000
  return false
}

function isSafeVideoRef(url: string): boolean {
  if (!url || typeof url !== "string") return false
  if (url.startsWith("blob:")) return false
  if (url.startsWith("data:video/")) return url.length < 8_000_000
  if (url.startsWith("https://")) return url.length < 2000
  return false
}

export async function POST(request: Request, ctx: Ctx) {
  return PATCH(request, ctx)
}

export async function PATCH(request: Request, ctx: Ctx) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }
  const { id } = await ctx.params
  const postId = String(id || "").trim()
  if (!postId) {
    return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 })
  }
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const content = String(body.content || "").trim()
  if (!content || content.length > 5000) {
    return NextResponse.json({ ok: false, error: "INVALID_CONTENT" }, { status: 400 })
  }

  const hasImagesKey = Object.prototype.hasOwnProperty.call(body, "images")
  const hasVideoKey = Object.prototype.hasOwnProperty.call(body, "video")
  const hasPdfKey = Object.prototype.hasOwnProperty.call(body, "pdf")

  let images: string[] | undefined
  if (hasImagesKey) {
    const raw = Array.isArray(body.images) ? body.images.map(String).slice(0, 10) : []
    images = raw.filter(isSafeImageRef)
    if (raw.length > 0 && images.length === 0) {
      return NextResponse.json(
        { ok: false, error: "INVALID_MEDIA", message: "Images must be durable https or data:image URLs." },
        { status: 400 }
      )
    }
  }

  let video: string | null | undefined
  if (hasVideoKey) {
    if (body.video == null || body.video === "") video = null
    else {
      const v = String(body.video)
      if (!isSafeVideoRef(v)) {
        return NextResponse.json({ ok: false, error: "INVALID_VIDEO" }, { status: 400 })
      }
      video = v
    }
  }

  let pdf: string | null | undefined
  let pdfName: string | null | undefined
  if (hasPdfKey) {
    if (body.pdf == null || body.pdf === "") {
      pdf = null
      pdfName = null
    } else {
      const p = String(body.pdf)
      if (p.startsWith("blob:") || p.length > 2_500_000) {
        return NextResponse.json({ ok: false, error: "INVALID_ATTACHMENT" }, { status: 400 })
      }
      pdf = p
      pdfName = body.pdfName ? String(body.pdfName).slice(0, 200) : null
    }
  }

  if (!socialDbConfigured()) {
    const nd = nonDurableWriteResponse("Post edit")
    return NextResponse.json({
      ...nd.body,
      content,
      ...(images !== undefined ? { images } : {}),
      ...(video !== undefined ? { video } : {}),
      ...(pdf !== undefined ? { pdf, pdfName } : {}),
    }, { status: nd.status })
  }

  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    return NextResponse.json({ ok: false, error: "DB_UNAVAILABLE" }, { status: 503 })
  }

  const getRes = await fetch(
    `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/gh_posts?id=eq.${encodeURIComponent(postId)}&select=author_id,deleted_at`,
    {
      headers: {
        apikey: env.supabaseServiceRoleKey,
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
      },
      cache: "no-store",
    }
  )
  const rows = (await getRes.json().catch(() => [])) as Array<{
    author_id?: string
    deleted_at?: string | null
  }>
  if (!Array.isArray(rows) || !rows[0] || rows[0].deleted_at) {
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 })
  }
  if (rows[0].author_id !== auth.userId) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 })
  }

  const patchBody: Record<string, unknown> = {
    content,
    is_edited: true,
    edited_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  if (images !== undefined) patchBody.images = images
  if (video !== undefined) patchBody.video = video
  if (pdf !== undefined) {
    patchBody.pdf = pdf
    patchBody.pdf_name = pdfName
  }

  const patchRes = await fetch(
    `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/gh_posts?id=eq.${encodeURIComponent(postId)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        apikey: env.supabaseServiceRoleKey,
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify(patchBody),
      cache: "no-store",
    }
  )
  if (!patchRes.ok) {
    return NextResponse.json({ ok: false, error: "EDIT_FAILED" }, { status: 503 })
  }
  return NextResponse.json({
    ok: true,
    durable: true,
    content,
    ...(images !== undefined ? { images } : {}),
    ...(video !== undefined ? { video } : {}),
    ...(pdf !== undefined ? { pdf, pdfName } : {}),
  })
}
