/**
 * PATCH /api/messaging/conversations/:id/prefs
 * Personal pin / archive / mute — never mutates global conversation state for other users.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import {
  setConversationPrefs,
  isMessagingStoreDurable,
} from "@/lib/server/messaging/message-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ conversationId: string }> }

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const auth = await resolveAuthenticatedUser(request.headers)
    if (!auth) {
      return NextResponse.json(
        { ok: false, error: "AUTH_REQUIRED" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      )
    }
    const { conversationId } = await ctx.params
    const body = await request.json().catch(() => ({}))

    const result = await setConversationPrefs({
      conversationId,
      ghUserId: auth.userId,
      isPinned: typeof body?.isPinned === "boolean" ? body.isPinned : undefined,
      isArchived: typeof body?.isArchived === "boolean" ? body.isArchived : undefined,
      mutedUntil:
        body?.mutedUntil === null
          ? null
          : typeof body?.mutedUntil === "number"
            ? body.mutedUntil
            : undefined,
    })

    if (!result.ok) {
      const status = result.error === "FORBIDDEN" ? 403 : 400
      return NextResponse.json(
        { ok: false, error: result.error },
        { status, headers: { "Cache-Control": "no-store" } }
      )
    }

    return NextResponse.json(
      {
        ok: true,
        durable: result.durable || isMessagingStoreDurable(),
        conversationId,
        isPinned: body?.isPinned,
        isArchived: body?.isArchived,
        mutedUntil: body?.mutedUntil,
      },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (err) {
    console.error(
      "[messaging/prefs PATCH]",
      err instanceof Error ? err.message : "unknown"
    )
    return NextResponse.json(
      { ok: false, error: "PREFS_FAILED" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    )
  }
}
