/**
 * Client helpers for durable messaging APIs.
 * Optimistic UI may show "sending"; permanent success only when API ok:true.
 * Drafts remain local-only and must never be treated as history.
 */

export async function apiListConversations(limit = 50) {
  const res = await fetch(`/api/messaging/conversations?limit=${limit}`, {
    credentials: "include",
    cache: "no-store",
  })
  const body = await res.json().catch(() => ({}))
  return { httpOk: res.ok, ...body }
}

export async function apiCreateDirectConversation(otherUserId: string) {
  const res = await fetch("/api/messaging/conversations", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
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
    { credentials: "include", cache: "no-store" }
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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: text, clientMessageId }),
      cache: "no-store",
    }
  )
  const body = await res.json().catch(() => ({}))
  return { httpOk: res.ok, ...body }
}
