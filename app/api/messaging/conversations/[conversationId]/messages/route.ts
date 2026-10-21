/**
 * GET  /api/messaging/conversations/:id/messages?limit=&before=
 * POST /api/messaging/conversations/:id/messages  { body, clientMessageId? }
 * PATCH edit/pin: { messageId, body? } or { messageId, pinned: boolean }
 * DELETE soft-delete via ?messageId=
 *
 * Membership enforced server-side. Success only after durable persist (prod).
 */

import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { socialRpc } from "@/lib/server/social/rpc"
import {
  listMessages,
  appendMessage,
  softDeleteMessage,
  editMessage,
  pinMessage,
  isMessagingStoreDurable,
} from "@/lib/server/messaging/message-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ conversationId: string }> }

export async function GET(request: Request, ctx: Ctx) {
  try {
    const auth = await resolveAuthenticatedUser(request.headers)
    if (!auth) {
      return NextResponse.json(
        { ok: false, error: "AUTH_REQUIRED" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      )
    }
    const readLimit = checkRateLimit(`msg-read:${auth.userId}`, 120, 60_000)
    if (!readLimit.ok) {
      return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": String(readLimit.retryAfterSec) } })
    }
    const { conversationId } = await ctx.params
    if (!conversationId || conversationId.length > 180 || /[\u0000-\u001f\u007f]/.test(conversationId)) {
      return NextResponse.json({ ok: false, error: "INVALID_CONVERSATION_ID" }, { status: 400, headers: { "Cache-Control": "no-store" } })
    }
    const url = new URL(request.url)
    const rawLimit = Number(url.searchParams.get("limit") || "50")
    const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 50, 1), 100)
    const before = url.searchParams.get("before")
    // Ignore client identity query params
    void url.searchParams.get("userId")
    void url.searchParams.get("senderId")

    const result = await listMessages({
      conversationId,
      ghUserId: auth.userId,
      limit,
      before,
    })
    if (!result.ok) {
      const status = result.error === "FORBIDDEN" ? 403 : result.error === "INVALID_CURSOR" ? 400 : 503
      return NextResponse.json(
        { ok: false, error: result.error },
        { status, headers: { "Cache-Control": "no-store" } }
      )
    }
    return NextResponse.json(
      {
        ok: true,
        durable: isMessagingStoreDurable(),
        messages: result.messages,
      },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (err) {
    console.error(
      "[messaging/messages GET]",
      err instanceof Error ? err.message : "unknown"
    )
    return NextResponse.json(
      { ok: false, error: "LIST_FAILED" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    )
  }
}

export async function POST(request: Request, ctx: Ctx) {
  try {
    const auth = await resolveAuthenticatedUser(request.headers)
    if (!auth) {
      return NextResponse.json(
        { ok: false, error: "AUTH_REQUIRED" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      )
    }
    const { conversationId } = await ctx.params
    if (!conversationId || conversationId.length > 180 || /[\u0000-\u001f\u007f]/.test(conversationId)) {
      return NextResponse.json({ ok: false, error: "INVALID_CONVERSATION_ID" }, { status: 400, headers: { "Cache-Control": "no-store" } })
    }
    const rl = checkRateLimit(`msg-send:${auth.userId}`, 60, 60_000)
    if (!rl.ok) {
      return NextResponse.json(
        { ok: false, error: "RATE_LIMITED" },
        { status: 429, headers: { "Cache-Control": "no-store" } }
      )
    }
    const contentLength = request.headers.get("content-length")
    if (contentLength && (!/^\d+$/.test(contentLength) || Number(contentLength) > 24 * 1024)) {
      return NextResponse.json({ ok: false, error: "REQUEST_TOO_LARGE" }, { status: 413, headers: { "Cache-Control": "no-store" } })
    }
    const body = await request.json().catch(() => ({}))
    // Actor is session only — never trust client identity fields
    void body.senderId
    void body.userId
    void body.authorId
    void body.actorId
    const text = typeof body?.body === "string" ? body.body.trim() : ""
    if (text.length > 8000) {
      return NextResponse.json(
        { ok: false, error: "TOO_LONG" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      )
    }
    const clientMessageId =
      typeof body?.clientMessageId === "string" ? body.clientMessageId : null
    const replyToMessageId =
      typeof body?.replyToMessageId === "string" ? body.replyToMessageId.trim() : ""
    const sharedPostId = typeof body?.sharedPostId === "string" ? body.sharedPostId.trim() : ""
    if (sharedPostId.length > 180 || /[\u0000-\u001f\u007f]/.test(sharedPostId)) {
      return NextResponse.json({ ok: false, error: "INVALID_SHARED_POST" }, { status: 400, headers: { "Cache-Control": "no-store" } })
    }
    if (replyToMessageId.length > 180 || /[\u0000-\u001f\u007f]/.test(replyToMessageId)) {
      return NextResponse.json({ ok: false, error: "INVALID_REPLY_TARGET" }, { status: 400, headers: { "Cache-Control": "no-store" } })
    }

    // Durable media only: https URLs, max 4. Never accept blob:/data: from clients.
    const rawAtts = Array.isArray(body?.mediaAttachments) ? body.mediaAttachments : Array.isArray(body?.attachments) ? body.attachments : []
    const mediaAttachments = rawAtts.slice(0, 4).map((item: unknown, i: number) => {
      if (!item || typeof item !== "object") return null
      const o = item as Record<string, unknown>
      const url = String(o.url || "").trim()
      if (!url || url.startsWith("blob:") || url.startsWith("data:") || url.length > 2048) return null
      try {
        const u = new URL(url)
        if (u.protocol !== "https:") return null
      } catch {
        return null
      }
      const typeRaw = String(o.type || "file").toLowerCase()
      const type = typeRaw === "image" || typeRaw === "video" || typeRaw === "file" ? typeRaw : "file"
      return {
        id: String(o.id || `att_${i}`).slice(0, 80),
        type,
        url,
        fileName: o.fileName != null ? String(o.fileName).slice(0, 180) : undefined,
        mimeType: o.mimeType != null ? String(o.mimeType).slice(0, 120) : undefined,
        sizeBytes: typeof o.sizeBytes === "number" ? o.sizeBytes : undefined,
      }
    }).filter(Boolean)

    if (rawAtts.length > 0 && mediaAttachments.length === 0) {
      return NextResponse.json({ ok: false, error: "INVALID_ATTACHMENTS" }, { status: 400, headers: { "Cache-Control": "no-store" } })
    }
    if (!text && mediaAttachments.length === 0) {
      return NextResponse.json({ ok: false, error: "EMPTY_BODY" }, { status: 400, headers: { "Cache-Control": "no-store" } })
    }

    const result = await appendMessage({
      conversationId,
      senderId: auth.userId,
      body: text,
      clientMessageId,
      replyToMessageId: replyToMessageId || undefined,
      sharedPostId: sharedPostId || undefined,
      mediaAttachments: mediaAttachments.length ? mediaAttachments as any : undefined,
    })
    if (!result.ok) {
      const status =
        result.error === "FORBIDDEN" || result.error === "BLOCKED" || result.error === "PRIVACY_RESTRICTED" || result.error === "SHARED_POST_PRIVATE"
          ? 403
          : result.error === "PRIVACY_SETTINGS_UNCONFIGURED"
            ? 409
          : result.error === "EMPTY_BODY" || result.error === "INVALID_ATTACHMENTS" || result.error === "INVALID_REPLY_TARGET"
            ? 400
            : result.error === "REPLY_TARGET_NOT_FOUND" || result.error === "INVALID_SHARED_POST"
              ? 404
              : 503
      return NextResponse.json(
        { ok: false, error: result.error },
        { status, headers: { "Cache-Control": "no-store" } }
      )
    }
    // Durable recipient notification: one server-side fan-out RPC after the
    // message was accepted, never for optimistic/local-only or idempotent retries.
    // Notification failure never turns a sent message into failure.
    if (isMessagingStoreDurable() && !result.idempotent) {
      await socialRpc("gh_social_notify_message_members", {
        p_sender_id: auth.userId,
        p_conversation_id: conversationId,
        p_message_id: result.message.id,
      }).catch(() => null)
    }

    return NextResponse.json(
      {
        ok: true,
        durable: isMessagingStoreDurable(),
        idempotent: Boolean(result.idempotent),
        message: result.message,
      },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (err) {
    console.error(
      "[messaging/messages POST]",
      err instanceof Error ? err.message : "unknown"
    )
    return NextResponse.json(
      { ok: false, error: "SEND_FAILED" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    )
  }
}

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const auth = await resolveAuthenticatedUser(request.headers)
    if (!auth) {
      return NextResponse.json(
        { ok: false, error: "AUTH_REQUIRED" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      )
    }
    const editLimit = checkRateLimit(`msg-edit:${auth.userId}`, 60, 60_000)
    if (!editLimit.ok) {
      return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": String(editLimit.retryAfterSec) } })
    }
    const { conversationId } = await ctx.params
    if (!conversationId || conversationId.length > 180 || /[\u0000-\u001f\u007f]/.test(conversationId)) {
      return NextResponse.json({ ok: false, error: "INVALID_CONVERSATION_ID" }, { status: 400, headers: { "Cache-Control": "no-store" } })
    }
    const contentLength = request.headers.get("content-length")
    if (contentLength && (!/^\d+$/.test(contentLength) || Number(contentLength) > 16 * 1024)) {
      return NextResponse.json({ ok: false, error: "REQUEST_TOO_LARGE" }, { status: 413, headers: { "Cache-Control": "no-store" } })
    }
    const body = await request.json().catch(() => ({}))
    const messageId = String(body?.messageId || "").trim()
    if (!messageId || messageId.length > 180 || /[\u0000-\u001f\u007f]/.test(messageId)) {
      return NextResponse.json(
        { ok: false, error: "MESSAGE_ID_REQUIRED" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      )
    }

    // Pin / unpin
    if (typeof body?.pinned === "boolean") {
      const result = await pinMessage({
        conversationId,
        messageId,
        actorId: auth.userId,
        pinned: body.pinned,
      })
      if (!result.ok) {
        const status = result.error === "FORBIDDEN" ? 403 : 404
        return NextResponse.json(
          { ok: false, error: result.error },
          { status, headers: { "Cache-Control": "no-store" } }
        )
      }
      return NextResponse.json(
        { ok: true, durable: result.durable, pinned: body.pinned, messageId },
        { headers: { "Cache-Control": "no-store" } }
      )
    }

    // Edit body
    const text = typeof body?.body === "string" ? body.body : ""
    if (text.length > 8000) {
      return NextResponse.json({ ok: false, error: "TOO_LONG" }, { status: 400, headers: { "Cache-Control": "no-store" } })
    }
    const result = await editMessage({
      conversationId,
      messageId,
      actorId: auth.userId,
      body: text,
    })
    if (!result.ok) {
      const status =
        result.error === "FORBIDDEN"
          ? 403
          : result.error === "EMPTY_BODY"
            ? 400
            : result.error === "NOT_FOUND" || result.error === "DELETED"
              ? 404
              : 503
      return NextResponse.json(
        { ok: false, error: result.error },
        { status, headers: { "Cache-Control": "no-store" } }
      )
    }
    return NextResponse.json(
      {
        ok: true,
        durable: result.durable,
        message: result.message,
      },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (err) {
    console.error(
      "[messaging/messages PATCH]",
      err instanceof Error ? err.message : "unknown"
    )
    return NextResponse.json(
      { ok: false, error: "PATCH_FAILED" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    )
  }
}

export async function DELETE(request: Request, ctx: Ctx) {
  try {
    const auth = await resolveAuthenticatedUser(request.headers)
    if (!auth) {
      return NextResponse.json(
        { ok: false, error: "AUTH_REQUIRED" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      )
    }
    const deleteLimit = checkRateLimit(`msg-delete:${auth.userId}`, 60, 60_000)
    if (!deleteLimit.ok) {
      return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": String(deleteLimit.retryAfterSec) } })
    }
    const { conversationId } = await ctx.params
    if (!conversationId || conversationId.length > 180 || /[\u0000-\u001f\u007f]/.test(conversationId)) {
      return NextResponse.json({ ok: false, error: "INVALID_CONVERSATION_ID" }, { status: 400, headers: { "Cache-Control": "no-store" } })
    }
    const url = new URL(request.url)
    const messageId = url.searchParams.get("messageId") || ""
    if (!messageId || messageId.length > 180 || /[\u0000-\u001f\u007f]/.test(messageId)) {
      return NextResponse.json(
        { ok: false, error: "MESSAGE_ID_REQUIRED" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      )
    }
    const result = await softDeleteMessage({
      conversationId,
      messageId,
      actorId: auth.userId,
    })
    if (!result.ok) {
      const status = result.error === "FORBIDDEN" ? 403 : 404
      return NextResponse.json(
        { ok: false, error: result.error },
        { status, headers: { "Cache-Control": "no-store" } }
      )
    }
    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (err) {
    console.error(
      "[messaging/messages DELETE]",
      err instanceof Error ? err.message : "unknown"
    )
    return NextResponse.json(
      { ok: false, error: "DELETE_FAILED" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    )
  }
}
