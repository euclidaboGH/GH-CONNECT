/**
 * PATCH /api/messaging/conversations/:id/prefs
 * Personal pin / archive / mute — never mutates global conversation state for other users.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { readBoundedJson } from "@/lib/server/http/read-bounded-json"
import {
  setConversationPrefs,
  isMessagingStoreDurable,
} from "@/lib/server/messaging/message-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ conversationId: string }> }
const noStore = { "Cache-Control": "no-store" }

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const auth = await resolveAuthenticatedUser(request.headers)
    if (!auth) {
      return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: noStore })
    }
    const rl = checkRateLimit(`messaging-conversation-prefs-write:${auth.userId}`, 30, 60_000)
    if (!rl.ok) {
      return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, {
        status: 429,
        headers: { ...noStore, "Retry-After": String(rl.retryAfterSec) },
      })
    }

    const { conversationId } = await ctx.params
    if (!conversationId || conversationId.length > 180 || /[\u0000-\u001f\u007f]/.test(conversationId)) {
      return NextResponse.json({ ok: false, error: "INVALID_CONVERSATION_ID" }, { status: 400, headers: noStore })
    }

    const parsed = await readBoundedJson(request, 4 * 1024)
    if (!parsed.ok) {
      const status = parsed.error === "REQUEST_TOO_LARGE" ? 413 : 400
      return NextResponse.json({ ok: false, error: parsed.error }, { status, headers: noStore })
    }
    const body = parsed.value
    const hasPinned = body.isPinned !== undefined
    const hasArchived = body.isArchived !== undefined
    const hasMutedUntil = body.mutedUntil !== undefined
    if (
      (!hasPinned && !hasArchived && !hasMutedUntil) ||
      (hasPinned && typeof body.isPinned !== "boolean") ||
      (hasArchived && typeof body.isArchived !== "boolean") ||
      (hasMutedUntil && body.mutedUntil !== null &&
        (typeof body.mutedUntil !== "number" || !Number.isSafeInteger(body.mutedUntil) ||
          body.mutedUntil < 0 || body.mutedUntil > 8_640_000_000_000_000))
    ) {
      return NextResponse.json({ ok: false, error: "INVALID_PREFERENCE" }, { status: 400, headers: noStore })
    }

    const result = await setConversationPrefs({
      conversationId,
      ghUserId: auth.userId,
      ...(hasPinned ? { isPinned: body.isPinned as boolean } : {}),
      ...(hasArchived ? { isArchived: body.isArchived as boolean } : {}),
      ...(hasMutedUntil ? { mutedUntil: body.mutedUntil as number | null } : {}),
    })

    if (!result.ok) {
      const status = result.error === "FORBIDDEN" ? 403 : result.error === "STORE_UNAVAILABLE" ? 503 : 400
      return NextResponse.json({ ok: false, error: result.error }, { status, headers: noStore })
    }

    return NextResponse.json({
      ok: true,
      durable: result.durable || isMessagingStoreDurable(),
      conversationId,
      ...(hasPinned ? { isPinned: body.isPinned } : {}),
      ...(hasArchived ? { isArchived: body.isArchived } : {}),
      ...(hasMutedUntil ? { mutedUntil: body.mutedUntil } : {}),
    }, { headers: noStore })
  } catch (err) {
    console.error("[messaging/prefs PATCH]", err instanceof Error ? err.message : "unknown")
    return NextResponse.json({ ok: false, error: "PREFS_FAILED" }, { status: 500, headers: noStore })
  }
}
