/**
 * PATCH /api/social/posts/[id]/edit — edit own post content only.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { socialDbConfigured } from "@/lib/server/social/rpc"
import { readGhcServerEnv } from "@/lib/server/economy/env"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

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

  if (!socialDbConfigured()) {
    return NextResponse.json({ ok: true, durable: false, content })
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
        is_edited: true,
        edited_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
    }
  )
  if (!patchRes.ok) {
    return NextResponse.json({ ok: false, error: "EDIT_FAILED" }, { status: 503 })
  }
  return NextResponse.json({ ok: true, durable: true, content })
}
