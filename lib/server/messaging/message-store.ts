/**
 * Durable messaging store (server-only).
 * Authorization: every read/write checks conversation membership for auth.userId.
 * Idempotency: client_message_id unique per (conversation, sender).
 * Production refuses process-memory as sole authority.
 */

import { createHash, randomBytes } from "crypto"
import { readGhcServerEnv, hasPrivilegedDatabase } from "@/lib/server/economy/env"

export type ConversationKind = "direct" | "group" | "community"

export type DurableConversation = {
  id: string
  kind: ConversationKind
  title: string | null
  createdBy: string
  createdAt: number
  updatedAt: number
  lastMessageAt: number | null
  lastMessagePreview: string | null
  memberIds: string[]
}

export type DurableMessage = {
  id: string
  conversationId: string
  senderId: string
  clientMessageId: string | null
  body: string
  status: string
  createdAt: number
  editedAt: number | null
  deletedAt: number | null
  deletedBy: string | null
}

const memConv = new Map<string, DurableConversation>()
const memMembers = new Map<string, Set<string>>() // convId -> user ids
const memMessages = new Map<string, DurableMessage[]>() // convId -> messages

function dbConfigured() {
  return hasPrivilegedDatabase()
}

function isProd() {
  return (
    process.env.VERCEL_ENV === "production" ||
    process.env.NODE_ENV === "production" ||
    process.env.GHC_ENV === "production"
  )
}

function newId(prefix: string) {
  return `${prefix}_${randomBytes(12).toString("hex")}`
}

function previewOf(body: string) {
  const t = body.replace(/\s+/g, " ").trim()
  return t.slice(0, 140)
}

async function rest<T>(
  path: string,
  init?: RequestInit & { prefer?: string }
): Promise<{ ok: boolean; status: number; data: T | null }> {
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    return { ok: false, status: 0, data: null }
  }
  try {
    const headers: Record<string, string> = {
      apikey: env.supabaseServiceRoleKey,
      Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
      Accept: "application/json",
      ...(init?.headers as Record<string, string> | undefined),
    }
    if (init?.prefer) headers.Prefer = init.prefer
    if (init?.body && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json"
    }
    const res = await fetch(`${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/${path}`, {
      ...init,
      headers,
      cache: "no-store",
    })
    if (res.status === 204) return { ok: res.ok, status: res.status, data: null }
    const data = (await res.json().catch(() => null)) as T | null
    return { ok: res.ok, status: res.status, data }
  } catch {
    return { ok: false, status: 0, data: null }
  }
}

export function isMessagingStoreDurable(): boolean {
  return dbConfigured()
}

export async function isMember(
  conversationId: string,
  ghUserId: string
): Promise<boolean> {
  const cid = String(conversationId || "").trim()
  const uid = String(ghUserId || "").trim()
  if (!cid || !uid) return false

  if (dbConfigured()) {
    const q = `gh_conversation_members?conversation_id=eq.${encodeURIComponent(cid)}&gh_user_id=eq.${encodeURIComponent(uid)}&left_at=is.null&select=gh_user_id&limit=1`
    const { ok, data } = await rest<Array<{ gh_user_id: string }>>(q)
    if (ok && Array.isArray(data) && data.length > 0) return true
    if (ok) return false
  }
  const set = memMembers.get(cid)
  return Boolean(set?.has(uid))
}

export async function listConversationsForUser(
  ghUserId: string,
  opts?: { limit?: number }
): Promise<DurableConversation[]> {
  const uid = String(ghUserId || "").trim()
  if (!uid) return []
  const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 100)

  if (dbConfigured()) {
    const memQ = `gh_conversation_members?gh_user_id=eq.${encodeURIComponent(uid)}&left_at=is.null&select=conversation_id&limit=${limit}`
    const memRes = await rest<Array<{ conversation_id: string }>>(memQ)
    if (memRes.ok && Array.isArray(memRes.data)) {
      const ids = memRes.data.map((r) => r.conversation_id).filter(Boolean)
      if (ids.length === 0) return []
      const inList = ids.map(encodeURIComponent).join(",")
      const convQ = `gh_conversations?id=in.(${inList})&select=*&order=updated_at.desc`
      const convRes = await rest<Array<Record<string, unknown>>>(convQ)
      if (convRes.ok && Array.isArray(convRes.data)) {
        const out: DurableConversation[] = []
        for (const row of convRes.data) {
          const id = String(row.id || "")
          const members = await listMemberIds(id)
          out.push({
            id,
            kind: (row.kind as ConversationKind) || "direct",
            title: row.title != null ? String(row.title) : null,
            createdBy: String(row.created_by || ""),
            createdAt: row.created_at ? Date.parse(String(row.created_at)) : Date.now(),
            updatedAt: row.updated_at ? Date.parse(String(row.updated_at)) : Date.now(),
            lastMessageAt: row.last_message_at
              ? Date.parse(String(row.last_message_at))
              : null,
            lastMessagePreview:
              row.last_message_preview != null
                ? String(row.last_message_preview)
                : null,
            memberIds: members,
          })
        }
        return out
      }
    }
  }

  const result: DurableConversation[] = []
  for (const [cid, set] of memMembers) {
    if (set.has(uid)) {
      const c = memConv.get(cid)
      if (c) result.push({ ...c, memberIds: [...set] })
    }
  }
  return result
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limit)
}

async function listMemberIds(conversationId: string): Promise<string[]> {
  if (dbConfigured()) {
    const q = `gh_conversation_members?conversation_id=eq.${encodeURIComponent(conversationId)}&left_at=is.null&select=gh_user_id`
    const { ok, data } = await rest<Array<{ gh_user_id: string }>>(q)
    if (ok && Array.isArray(data)) return data.map((r) => r.gh_user_id)
  }
  return [...(memMembers.get(conversationId) || [])]
}

export async function createDirectConversation(input: {
  creatorId: string
  otherUserId: string
}): Promise<DurableConversation | null> {
  const a = String(input.creatorId || "").trim()
  const b = String(input.otherUserId || "").trim()
  if (!a || !b || a === b) return null

  // Stable id for direct pairs (sorted) — prevents duplicate DM threads
  const pair = [a, b].sort()
  const id = `dm_${createHash("sha256").update(pair.join(":")).digest("hex").slice(0, 24)}`

  if (await isMember(id, a)) {
    const list = await listConversationsForUser(a, { limit: 100 })
    const existing = list.find((c) => c.id === id)
    if (existing) return existing
  }

  const t = Date.now()
  const conv: DurableConversation = {
    id,
    kind: "direct",
    title: null,
    createdBy: a,
    createdAt: t,
    updatedAt: t,
    lastMessageAt: null,
    lastMessagePreview: null,
    memberIds: pair,
  }

  if (dbConfigured()) {
    const up = await rest("gh_conversations", {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=representation",
      body: JSON.stringify({
        id: conv.id,
        kind: "direct",
        created_by: a,
        updated_at: new Date(t).toISOString(),
      }),
    })
    if (!up.ok && isProd()) {
      console.error("[messaging] create conversation failed", up.status)
      return null
    }
    for (const uid of pair) {
      await rest("gh_conversation_members", {
        method: "POST",
        prefer: "resolution=merge-duplicates",
        body: JSON.stringify({
          conversation_id: id,
          gh_user_id: uid,
          role: uid === a ? "owner" : "member",
        }),
      })
    }
  } else if (isProd()) {
    return null
  }

  memConv.set(id, conv)
  memMembers.set(id, new Set(pair))
  return conv
}

export async function listMessages(input: {
  conversationId: string
  ghUserId: string
  limit?: number
  before?: string | null // ISO or ms cursor on created_at
}): Promise<{ ok: true; messages: DurableMessage[] } | { ok: false; error: string }> {
  const cid = String(input.conversationId || "").trim()
  const uid = String(input.ghUserId || "").trim()
  if (!(await isMember(cid, uid))) {
    return { ok: false, error: "FORBIDDEN" }
  }
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100)

  if (dbConfigured()) {
    let q = `gh_messages?conversation_id=eq.${encodeURIComponent(cid)}&select=*&order=created_at.desc&limit=${limit}`
    if (input.before) {
      const beforeIso = Number.isFinite(Number(input.before))
        ? new Date(Number(input.before)).toISOString()
        : String(input.before)
      q += `&created_at=lt.${encodeURIComponent(beforeIso)}`
    }
    const { ok, data } = await rest<Array<Record<string, unknown>>>(q)
    if (ok && Array.isArray(data)) {
      const messages = data.map(rowToMessage).reverse()
      return { ok: true, messages }
    }
    if (isProd()) return { ok: false, error: "STORE_UNAVAILABLE" }
  }

  const all = memMessages.get(cid) || []
  let filtered = all
  if (input.before) {
    const ts = Number(input.before) || Date.parse(String(input.before))
    if (ts) filtered = all.filter((m) => m.createdAt < ts)
  }
  return { ok: true, messages: filtered.slice(-limit) }
}

function rowToMessage(row: Record<string, unknown>): DurableMessage {
  return {
    id: String(row.id || ""),
    conversationId: String(row.conversation_id || ""),
    senderId: String(row.sender_id || ""),
    clientMessageId:
      row.client_message_id != null ? String(row.client_message_id) : null,
    body: row.deleted_at ? "" : String(row.body || ""),
    status: String(row.status || "sent"),
    createdAt: row.created_at ? Date.parse(String(row.created_at)) : Date.now(),
    editedAt: row.edited_at ? Date.parse(String(row.edited_at)) : null,
    deletedAt: row.deleted_at ? Date.parse(String(row.deleted_at)) : null,
    deletedBy: row.deleted_by != null ? String(row.deleted_by) : null,
  }
}

export async function appendMessage(input: {
  conversationId: string
  senderId: string
  body: string
  clientMessageId?: string | null
}): Promise<
  | { ok: true; message: DurableMessage; idempotent?: boolean }
  | { ok: false; error: string }
> {
  const cid = String(input.conversationId || "").trim()
  const uid = String(input.senderId || "").trim()
  const body = String(input.body || "").trim().slice(0, 8000)
  const clientMessageId = input.clientMessageId
    ? String(input.clientMessageId).trim().slice(0, 80)
    : null

  if (!body) return { ok: false, error: "EMPTY_BODY" }
  if (!(await isMember(cid, uid))) return { ok: false, error: "FORBIDDEN" }

  // Idempotent replay
  if (clientMessageId && dbConfigured()) {
    const q = `gh_messages?conversation_id=eq.${encodeURIComponent(cid)}&sender_id=eq.${encodeURIComponent(uid)}&client_message_id=eq.${encodeURIComponent(clientMessageId)}&select=*&limit=1`
    const existing = await rest<Array<Record<string, unknown>>>(q)
    if (existing.ok && existing.data?.[0]) {
      return { ok: true, message: rowToMessage(existing.data[0]), idempotent: true }
    }
  }

  const t = Date.now()
  const msg: DurableMessage = {
    id: newId("msg"),
    conversationId: cid,
    senderId: uid,
    clientMessageId,
    body,
    status: "sent",
    createdAt: t,
    editedAt: null,
    deletedAt: null,
    deletedBy: null,
  }

  if (dbConfigured()) {
    const ins = await rest<Array<Record<string, unknown>>>("gh_messages", {
      method: "POST",
      prefer: "return=representation",
      body: JSON.stringify({
        id: msg.id,
        conversation_id: cid,
        sender_id: uid,
        client_message_id: clientMessageId,
        body,
        status: "sent",
        created_at: new Date(t).toISOString(),
      }),
    })
    if (!ins.ok) {
      // unique violation → fetch existing
      if (clientMessageId) {
        const q = `gh_messages?conversation_id=eq.${encodeURIComponent(cid)}&sender_id=eq.${encodeURIComponent(uid)}&client_message_id=eq.${encodeURIComponent(clientMessageId)}&select=*&limit=1`
        const existing = await rest<Array<Record<string, unknown>>>(q)
        if (existing.ok && existing.data?.[0]) {
          return {
            ok: true,
            message: rowToMessage(existing.data[0]),
            idempotent: true,
          }
        }
      }
      if (isProd()) return { ok: false, error: "PERSIST_FAILED" }
    } else if (ins.data?.[0]) {
      Object.assign(msg, rowToMessage(ins.data[0]))
    }
    await rest(
      `gh_conversations?id=eq.${encodeURIComponent(cid)}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          updated_at: new Date(t).toISOString(),
          last_message_at: new Date(t).toISOString(),
          last_message_preview: previewOf(body),
        }),
      }
    )
  } else if (isProd()) {
    return { ok: false, error: "STORE_UNAVAILABLE" }
  }

  const list = memMessages.get(cid) || []
  if (clientMessageId && list.some((m) => m.clientMessageId === clientMessageId)) {
    return {
      ok: true,
      message: list.find((m) => m.clientMessageId === clientMessageId)!,
      idempotent: true,
    }
  }
  list.push(msg)
  memMessages.set(cid, list)
  const conv = memConv.get(cid)
  if (conv) {
    memConv.set(cid, {
      ...conv,
      updatedAt: t,
      lastMessageAt: t,
      lastMessagePreview: previewOf(body),
    })
  }
  return { ok: true, message: msg }
}

export async function softDeleteMessage(input: {
  conversationId: string
  messageId: string
  actorId: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const cid = String(input.conversationId || "").trim()
  const mid = String(input.messageId || "").trim()
  const uid = String(input.actorId || "").trim()
  if (!(await isMember(cid, uid))) return { ok: false, error: "FORBIDDEN" }

  if (dbConfigured()) {
    // Only sender can soft-delete own message (MVP)
    const q = `gh_messages?id=eq.${encodeURIComponent(mid)}&conversation_id=eq.${encodeURIComponent(cid)}&sender_id=eq.${encodeURIComponent(uid)}`
    const res = await rest(q, {
      method: "PATCH",
      body: JSON.stringify({
        status: "deleted",
        body: "",
        deleted_at: new Date().toISOString(),
        deleted_by: uid,
      }),
    })
    if (!res.ok && isProd()) return { ok: false, error: "DELETE_FAILED" }
    return { ok: true }
  }
  const list = memMessages.get(cid) || []
  const idx = list.findIndex((m) => m.id === mid && m.senderId === uid)
  if (idx < 0) return { ok: false, error: "NOT_FOUND" }
  list[idx] = {
    ...list[idx],
    status: "deleted",
    body: "",
    deletedAt: Date.now(),
    deletedBy: uid,
  }
  memMessages.set(cid, list)
  return { ok: true }
}
