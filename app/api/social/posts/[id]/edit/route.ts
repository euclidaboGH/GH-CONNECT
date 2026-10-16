/**
 * PATCH /api/social/posts/[id]/edit — edit own post content only.
 * POST is accepted as an alias (same handler) so older clients do not get 405.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { socialDbConfigured } from "@/lib/server/social/rpc"
import { readGhcServerEnv } from "@/lib/server/economy/env"
import { nonDurableWriteResponse, nonDurableReadResponse } from "@/lib/server/production-guard"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

const MAX_DATA_URL_CHARS = 900_000
const MAX_HTTPS_URL = 2000
function safeImage(ref: unknown): string | null {
  const s = String(ref || "").trim()
  if (!s || s.startsWith("blob:")) return null
  if (s.startsWith("data:image/") && s.length <= MAX_DATA_URL_CHARS) return s
  if (s.startsWith("https://") && s.length <= MAX_HTTPS_URL) return s
  return null
}
function safeVideo(ref: unknown): string | null {
  if (ref == null || ref === "") return null
  const s = String(ref).trim()
  if (s.startsWith("blob:")) return null
  if (s.startsWith("data:video/") && s.length <= 2_500_000) return s
  if (s.startsWith("https://") && s.length <= MAX_HTTPS_URL) return s
  return null
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
  const body = await request.json().catch(() => ({}))
  const content = String(body.content || "").trim()
  if (!content || content.length > 5000) {
    return NextResponse.json({ ok: false, error: "INVALID_CONTENT" }, { status: 400 })
  }
  const hasImages = Object.prototype.hasOwnProperty.call(body, "images")
  const hasVideo = Object.prototype.hasOwnProperty.call(body, "video")
  const rawImages = hasImages && Array.isArray(body.images) ? body.images.slice(0, 10) : []
  const images = rawImages.map(safeImage)
  if (hasImages && (rawImages.length !== (body.images as unknown[]).length || images.some((x: string | null) => !x))) {
    return NextResponse.json({ ok: false, error: "INVALID_MEDIA" }, { status: 400 })
  }
  const video = hasVideo ? safeVideo(body.video) : null
  if (hasVideo && body.video && !video) {
    return NextResponse.json({ ok: false, error: "INVALID_MEDIA" }, { status: 400 })
  }

  if (!socialDbConfigured()) {
    const nd = nonDurableWriteResponse("Post edit")
    return NextResponse.json(nd.body, { status: nd.status })
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

  const patchRes = await fetch(
    `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/gh_posts?id=eq.${encodeURIComponent(postId)}&author_id=eq.${encodeURIComponent(auth.userId)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        apikey: env.supabaseServiceRoleKey,
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        content,
        ...(hasImages ? { images } : {}),
        ...(hasVideo ? { video } : {}),
        is_edited: true,
        edited_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
    }
  )
  if (!patchRes.ok) {
    return NextResponse.json({ ok: false, error: "EDIT_FAILED" }, { status: 503 })
  }
  return NextResponse.json({ ok: true, durable: true, content, ...(hasImages ? { images } : {}), ...(hasVideo ? { video } : {}) })
}
