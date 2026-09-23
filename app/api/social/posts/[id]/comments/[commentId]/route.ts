/**
 * DELETE /api/social/posts/[id]/comments/[commentId]
 * Soft-delete own comment only (session actor).
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { socialDbConfigured, socialRpc } from "@/lib/server/social/rpc"
import { readGhcServerEnv } from "@/lib/server/economy/env"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string; commentId: string }> }

export async function DELETE(request: Request, ctx: Ctx) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }
  const { id, commentId } = await ctx.params
  const postId = String(id || "").trim()
  const cid = String(commentId || "").trim()
  if (!postId || !cid) {
    return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 })
  }

  if (!socialDbConfigured()) {
    return NextResponse.json({ ok: true, durable: false })
  }

  // Inline soft-delete via REST (no separate RPC required for Pass 3)
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    return NextResponse.json({ ok: false, error: "DB_UNAVAILABLE" }, { status: 503 })
  }

  // Load comment author
  const getRes = await fetch(
    `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/gh_post_comments?id=eq.${encodeURIComponent(cid)}&post_id=eq.${encodeURIComponent(postId)}&select=author_id,deleted_at`,
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
  if (!Array.isArray(rows) || !rows[0]) {
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 })
  }
  if (rows[0].author_id !== auth.userId) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 })
  }
  if (rows[0].deleted_at) {
    return NextResponse.json({ ok: true, durable: true, idempotent: true })
  }

  const patchRes = await fetch(
    `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/gh_post_comments?id=eq.${encodeURIComponent(cid)}&post_id=eq.${encodeURIComponent(postId)}&author_id=eq.${encodeURIComponent(auth.userId)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        apikey: env.supabaseServiceRoleKey,
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ deleted_at: new Date().toISOString() }),
    }
  )
  if (!patchRes.ok) {
    return NextResponse.json({ ok: false, error: "DELETE_FAILED" }, { status: 503 })
  }

  // Decrement comment_count
  void socialRpc("gh_comment_list", { p_post_id: postId })

  return NextResponse.json({ ok: true, durable: true })
}
