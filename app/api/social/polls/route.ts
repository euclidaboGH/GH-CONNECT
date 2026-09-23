/**
 * POST /api/social/polls — create poll (author = session)
 * POST /api/social/polls with { pollId, optionId, action: "vote" } — vote once
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { socialDbConfigured, socialRpc } from "@/lib/server/social/rpc"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function genId() {
  return `poll_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }
  const body = await request.json().catch(() => ({}))

  if (body.action === "vote" || body.pollId) {
    const pollId = String(body.pollId || "").trim()
    const optionId = String(body.optionId || "").trim()
    if (!pollId || !optionId) {
      return NextResponse.json({ ok: false, error: "INVALID_VOTE" }, { status: 400 })
    }
    if (!socialDbConfigured()) {
      return NextResponse.json({ ok: true, durable: false })
    }
    const result = await socialRpc("gh_poll_vote", {
      p_poll_id: pollId,
      p_user_id: auth.userId,
      p_option_id: optionId,
    })
    const data = result.data as { ok?: boolean; error?: string }
    if (!result.ok || data?.ok === false) {
      const code = data?.error || result.error || "VOTE_FAILED"
      const status = code === "ALREADY_VOTED" ? 409 : code === "NOT_FOUND" ? 404 : 503
      return NextResponse.json({ ok: false, error: code }, { status })
    }
    return NextResponse.json({ ok: true, durable: true })
  }

  const question = String(body.question || "").trim()
  const options = Array.isArray(body.options) ? body.options : []
  if (!question || options.length < 2) {
    return NextResponse.json({ ok: false, error: "INVALID_POLL" }, { status: 400 })
  }
  const normalized = options.slice(0, 8).map((o: unknown, i: number) => {
    if (typeof o === "string") return { id: `opt_${i}`, text: o.slice(0, 120) }
    const obj = o as { id?: string; text?: string }
    return {
      id: String(obj.id || `opt_${i}`).slice(0, 40),
      text: String(obj.text || "").slice(0, 120),
    }
  })
  if (normalized.some((o: { text: string }) => !o.text)) {
    return NextResponse.json({ ok: false, error: "EMPTY_OPTION" }, { status: 400 })
  }

  const row = {
    id: String(body.id || "").trim() || genId(),
    postId: body.postId ? String(body.postId) : null,
    authorId: auth.userId,
    question: question.slice(0, 500),
    options: normalized,
    closesAt: typeof body.closesAt === "number" ? body.closesAt : null,
  }

  if (!socialDbConfigured()) {
    return NextResponse.json({ ok: true, durable: false, poll: row })
  }
  const result = await socialRpc("gh_poll_create", { p_row: row })
  const data = result.data as { ok?: boolean; error?: string }
  if (!result.ok || data?.ok === false) {
    return NextResponse.json(
      { ok: false, error: data?.error || result.error || "CREATE_FAILED" },
      { status: 503 }
    )
  }
  return NextResponse.json({ ok: true, durable: true, poll: row })
}
