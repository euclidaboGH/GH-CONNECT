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
    const { conversationId } = await ctx.params
    const url = new URL(request.url)
    const limit = Number(url.searchParams.get("limit") || "50")
    const before = url.searchParams.get("before")

    const result = await listMessages({
      conversationId,
      ghUserId: auth.userId,
      limit: Number.isFinite(limit) ? limit : 50,
      before,
    })
    if (!result.ok) {
      const status = result.error === "FORBIDDEN" ? 403 : 503
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
    const body = await request.json().catch(() => ({}))
    const text = typeof body?.body === "string" ? body.body : ""
    const clientMessageId =
      typeof body?.clientMessageId === "string" ? body.clientMessageId : null

    // Never trust body.senderId
    const result = await appendMessage({
      conversationId,
      senderId: auth.userId,
      body: text,
      clientMessageId,
    })
    if (!result.ok) {
      const status =
        result.error === "FORBIDDEN"
          ? 403
          : result.error === "EMPTY_BODY"
            ? 400
            : 503
      return NextResponse.json(
        { ok: false, error: result.error },
        { status, headers: { "Cache-Control": "no-store" } }
      )
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
    const { conversationId } = await ctx.params
    const body = await request.json().catch(() => ({}))
    const messageId = String(body?.messageId || "").trim()
    if (!messageId) {
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
    const { conversationId } = await ctx.params
    const url = new URL(request.url)
    const messageId = url.searchParams.get("messageId") || ""
    if (!messageId) {
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
