/**
 * POST /api/social/tips — create tip INTENT only.
 * Settlement is deferred. Never credits wallet/ledger.
 * Recipient derived from content when contentId provided.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import {
  createTipIntent,
  resolvePostAuthor,
} from "@/lib/server/creator/store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }

  const rl = checkRateLimit(`tips:${auth.userId}`, 15, 60_000)
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 })
  }

  let body: {
    contentId?: string
    recipientUserId?: string
    currency?: string
    amount?: number
    note?: string
    idempotencyKey?: string
  } = {}
  try {
    body = (await request.json()) as typeof body
  } catch {
    body = {}
  }

  let recipientId = ""
  let contentKind = "profile"
  const contentId = body.contentId ? String(body.contentId).trim() : ""

  if (contentId) {
    const post = await resolvePostAuthor(contentId)
    if (!post.ok || !post.authorId) {
      return NextResponse.json(
        { ok: false, error: post.error || "CONTENT_NOT_FOUND" },
        { status: 404 }
      )
    }
    recipientId = post.authorId
    contentKind = "post"
  } else if (body.recipientUserId) {
    // Profile tip: recipient must still pass tips_enabled check in RPC
    recipientId = String(body.recipientUserId).trim()
    contentKind = "profile"
  } else {
    return NextResponse.json(
      { ok: false, error: "RECIPIENT_OR_CONTENT_REQUIRED" },
      { status: 400 }
    )
  }

  if (recipientId === auth.userId) {
    return NextResponse.json({ ok: false, error: "SELF_TIP_FORBIDDEN" }, { status: 400 })
  }

  // Server-forced logical key — never Date.now(); client keys are not trusted alone.
  // One open intent bucket per tipper+recipient+content (currency optional suffix).
  const currencyKey =
    body.currency && ["PI", "GHC"].includes(String(body.currency).toUpperCase())
      ? String(body.currency).toUpperCase()
      : "PI"
  const idem = contentId
    ? `tip:${auth.userId}:post:${contentId}:${currencyKey}`
    : `tip:${auth.userId}:profile:${recipientId}:${currencyKey}`

  const currency =
    body.currency && ["PI", "GHC"].includes(String(body.currency).toUpperCase())
      ? String(body.currency).toUpperCase()
      : "PI"

  const result = await createTipIntent({
    tipperId: auth.userId,
    recipientId,
    idempotencyKey: idem.slice(0, 200),
    contentId: contentId || undefined,
    contentKind,
    currency,
    amountUnits:
      typeof body.amount === "number" && body.amount > 0 && body.amount < 1e9
        ? body.amount
        : undefined,
    note: body.note ? String(body.note).slice(0, 280) : undefined,
  })

  if (!result.ok) {
    const status =
      result.error === "RECIPIENT_NOT_TIPPABLE"
        ? 400
        : result.error === "SELF_TIP_FORBIDDEN"
          ? 400
          : 400
    return NextResponse.json({ ok: false, error: result.error }, { status })
  }

  // Explicit: never claim completed payment
  return NextResponse.json({
    ok: true,
    durable: true,
    intentId: result.intentId,
    status: result.status,
    settlement: "deferred",
    message:
      result.message ||
      "Tip intent recorded. Financial settlement is not enabled in this phase.",
    completed: false,
  })
}
