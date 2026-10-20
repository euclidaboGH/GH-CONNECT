/**
 * Client helpers for durable messaging APIs.
 * Optimistic UI may show "sending"; permanent success only when API ok:true.
 * Drafts remain local-only and must never be treated as history.
 */
import { IdentityService } from "@/lib/identity/identity-service"

function authHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...IdentityService.getAuthHeaders(),
  }
}

export async function apiListConversations(limit = 50) {
  const res = await fetch(`/api/messaging/conversations?limit=${limit}`, {
    credentials: "include",
    cache: "no-store",
    headers: authHeaders(),
  })
  const body = await res.json().catch(() => ({}))
  return { httpOk: res.ok, ...body }
}

export async function apiCreateDirectConversation(otherUserId: string) {
  const res = await fetch("/api/messaging/conversations", {
    method: "POST",
    credentials: "include",
    headers: authHeaders(),
    body: JSON.stringify({ otherUserId }),
    cache: "no-store",
  })
  const body = await res.json().catch(() => ({}))
  return { httpOk: res.ok, ...body }
}

export async function apiListMessages(
  conversationId: string,
  opts?: { limit?: number; before?: string | number }
) {
  const q = new URLSearchParams()
  if (opts?.limit) q.set("limit", String(opts.limit))
  if (opts?.before != null) q.set("before", String(opts.before))
  const res = await fetch(
    `/api/messaging/conversations/${encodeURIComponent(conversationId)}/messages?${q}`,
    { credentials: "include", cache: "no-store", headers: authHeaders() }
  )
  const body = await res.json().catch(() => ({}))
  return { httpOk: res.ok, ...body }
}

export async function apiSendMessage(
  conversationId: string,
  text: string,
  clientMessageId: string,
  replyToMessageId?: string,
  sharedPostId?: string,
  mediaAttachments?: Array<{
    id?: string
    type: "image" | "video" | "file"
    url: string
    fileName?: string
    mimeType?: string
    sizeBytes?: number
  }>,
) {
  const res = await fetch(
    `/api/messaging/conversations/${encodeURIComponent(conversationId)}/messages`,
    {
      method: "POST",
      credentials: "include",
      headers: authHeaders(),
      body: JSON.stringify({
        body: text,
        clientMessageId,
        replyToMessageId: replyToMessageId || undefined,
        sharedPostId: sharedPostId || undefined,
        mediaAttachments: mediaAttachments?.length ? mediaAttachments : undefined,
      }),
      cache: "no-store",
    }
  )
  const body = await res.json().catch(() => ({}))
  return { httpOk: res.ok, ...body }
}

export async function apiDeleteMessage(conversationId: string, messageId: string) {
  const q = new URLSearchParams({ messageId })
  const res = await fetch(
    `/api/messaging/conversations/${encodeURIComponent(conversationId)}/messages?${q}`,
    {
      method: "DELETE",
      credentials: "include",
      headers: authHeaders(),
      cache: "no-store",
    }
  )
  const body = await res.json().catch(() => ({}))
  return { httpOk: res.ok, ...body }
}

export async function apiMarkConversationRead(conversationId: string) {
  const res = await fetch(
    `/api/messaging/conversations/${encodeURIComponent(conversationId)}/read`,
    {
      method: "POST",
      credentials: "include",
      headers: authHeaders(),
      body: JSON.stringify({}),
      cache: "no-store",
    }
  )
  const body = await res.json().catch(() => ({}))
  return { httpOk: res.ok, ...body }
}


export async function apiSendMessageWithRetry(
  conversationId: string,
  text: string,
  clientMessageId: string,
  replyToMessageId?: string,
  sharedPostId?: string,
) {
  const first = await apiSendMessage(conversationId, text, clientMessageId, replyToMessageId, sharedPostId)
  if (first.httpOk || first.ok === true) return first
  if (typeof first.error === "string" && /AUTH|FORBIDDEN|BLOCKED|PRIVACY_RESTRICTED|PRIVACY_SETTINGS_UNCONFIGURED|SHARED_POST_PRIVATE|INVALID_SHARED_POST|VALIDATION|TOO_LONG|EMPTY_BODY|REPLY_TARGET|INVALID_REPLY/i.test(first.error)) return first
  await new Promise((r) => setTimeout(r, 800))
  return apiSendMessage(conversationId, text, clientMessageId, replyToMessageId, sharedPostId)
}


export type MessagingPresenceAction = "heartbeat" | "typing" | "stop_typing"

export async function apiTouchConversationPresence(conversationId: string, action: MessagingPresenceAction) {
  const res = await fetch(`/api/messaging/conversations/${encodeURIComponent(conversationId)}/presence`, {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: authHeaders(),
    body: JSON.stringify({ action }),
  })
  const body = await res.json().catch(() => ({}))
  return { httpOk: res.ok, ...body }
}

export async function apiHeartbeatMessagingPresence() {
  const res = await fetch("/api/messaging/presence", {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: authHeaders(),
    body: JSON.stringify({}),
  })
  const body = await res.json().catch(() => ({}))
  return { httpOk: res.ok, ...body }
}
