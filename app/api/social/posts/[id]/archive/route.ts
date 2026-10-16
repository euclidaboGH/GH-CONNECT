/**
 * POST /api/social/posts/[id]/archive  { archived: boolean }
 * Owner-only durable archive / restore. Distinct from soft-delete.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { socialDbConfigured } from "@/lib/server/social/rpc"
import { readGhcServerEnv } from "@/lib/server/economy/env"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

export async function POST(request: Request, ctx: Ctx) {
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
  const archived = Boolean(body?.archived)

  if (!socialDbConfigured()) {
    return NextResponse.json({
      ok: true,
      durable: false,
      postId,
      archived,
    })
  }

  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    return NextResponse.json({ ok: false, error: "DB_UNAVAILABLE" }, { status: 503 })
  }

  try {
    const rpcRes = await fetch(
      `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/gh_set_post_archived`,
      {
        method: "POST",
        headers: {
          apikey: env.supabaseServiceRoleKey,
          Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          p_post_id: postId,
          p_actor_id: auth.userId,
          p_archived: archived,
        }),
        cache: "no-store",
      }
    )
    const rpcData = (await rpcRes.json().catch(() => null)) as {
      ok?: boolean
      error?: string
      archived?: boolean
      archived_at?: string | null
    } | null

    if (rpcRes.ok && rpcData?.ok === true) {
      return NextResponse.json({
        ok: true,
        durable: true,
        postId,
        archived: Boolean(rpcData.archived),
        archivedAt: rpcData.archived_at || null,
      })
    }

    if (rpcData?.ok === false) {
      const status =
        rpcData.error === "FORBIDDEN"
          ? 403
          : rpcData.error === "NOT_FOUND" || rpcData.error === "DELETED"
            ? 404
            : 400
      return NextResponse.json(
        { ok: false, error: rpcData.error || "ARCHIVE_FAILED" },
        { status }
      )
    }

    // Fallback PATCH if RPC not yet applied (migration 56 pending)
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
    if (String(rows[0].author_id) !== auth.userId) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 })
    }

    const patchRes = await fetch(
      `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/gh_posts?id=eq.${encodeURIComponent(postId)}`,
      {
        method: "PATCH",
        headers: {
          apikey: env.supabaseServiceRoleKey,
          Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          archived_at: archived ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        }),
        cache: "no-store",
      }
    )
    if (!patchRes.ok) {
      // Column may not exist until migration 56
      return NextResponse.json({
        ok: true,
        durable: false,
        postId,
        archived,
        error: "ARCHIVE_COLUMN_PENDING",
      })
    }
    return NextResponse.json({
      ok: true,
      durable: true,
      postId,
      archived,
    })
  } catch (err) {
    console.error(
      "[posts/archive]",
      err instanceof Error ? err.message : "unknown"
    )
    return NextResponse.json({ ok: false, error: "ARCHIVE_FAILED" }, { status: 500 })
  }
}
