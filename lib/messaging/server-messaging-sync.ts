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
  clientMessageId: string
) {
  const res = await fetch(
    `/api/messaging/conversations/${encodeURIComponent(conversationId)}/messages`,
    {
      method: "POST",
      credentials: "include",
      headers: authHeaders(),
      body: JSON.stringify({ body: text, clientMessageId }),
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
