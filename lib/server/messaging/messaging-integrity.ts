/**
 * Phase 5 — Messages & Notifications integrity helpers.
 */
import { NextResponse } from "next/server"
import type { ServerAuthContext } from "@/lib/server/economy/auth"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { isMessagingStoreDurable, isMember } from "@/lib/server/messaging/message-store"

export type MsgAuthOk = { ok: true; auth: ServerAuthContext }
export type MsgAuthFail = { ok: false; response: NextResponse }

function noStore(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, private" },
  })
}

export async function requireMessagingAuth(headers: Headers): Promise<MsgAuthOk | MsgAuthFail> {
  const auth = await resolveAuthenticatedUser(headers)
  if (!auth) {
    return { ok: false, response: noStore({ ok: false, error: "AUTH_REQUIRED" }, 401) }
  }
  return { ok: true, auth }
}

export function requireDurableMessagingInProduction(): MsgAuthFail | { ok: true } {
  const isProd =
    process.env.VERCEL_ENV === "production" ||
    process.env.NODE_ENV === "production" ||
    process.env.GHC_ENV === "production"
  if (isProd && !isMessagingStoreDurable()) {
    return {
      ok: false,
      response: noStore(
        {
          ok: false,
          error: "MESSAGING_DURABILITY_UNAVAILABLE",
          message: "Messaging requires a durable store in production.",
        },
        503
      ),
    }
  }
  return { ok: true }
}

export async function requireConversationMember(
  conversationId: string,
  userId: string
): Promise<{ ok: true } | { ok: false; error: "FORBIDDEN" | "INVALID_CONVERSATION" }> {
  const cid = String(conversationId || "").trim()
  const uid = String(userId || "").trim()
  if (!cid || !uid || cid.length > 160) return { ok: false, error: "INVALID_CONVERSATION" }
  if (!(await isMember(cid, uid))) return { ok: false, error: "FORBIDDEN" }
  return { ok: true }
}

export const MESSAGING_PHASE = "5-messages-notifications" as const
