/**
 * Phase D6 — server-side GHC notification events (authoritative when DB configured).
 * Dedupe by (userId, dedupeKey). Never accept client-created "received" as proof of payment.
 */

import { hasPrivilegedDatabase, readGhcServerEnv, type GhcServerEnv } from "./env"
import { getProcessGhcStore } from "./store"

export type GhcNotifEventType =
  | "GHC_SENT"
  | "GHC_RECEIVED"
  | "GHC_REQUEST_CREATED"
  | "GHC_REQUEST_ACCEPTED"
  | "GHC_REQUEST_DECLINED"
  | "GHC_REQUEST_CANCELLED"
  | "GHC_REQUEST_EXPIRED"
  | "GHC_TRANSFER_FAILED"
  | "GHC_TRANSFER_REVERSED"

export type GhcNotificationRecord = {
  id: string
  userId: string
  eventType: GhcNotifEventType | string
  title: string
  body: string
  referenceId?: string
  requestId?: string
  metadata?: Record<string, unknown>
  createdAt: number
  readAt?: number | null
  expiresAt?: number | null
  dedupeKey?: string
}

type MemoryNotif = GhcNotificationRecord

const memoryNotifs: MemoryNotif[] = []

function isDb(): boolean {
  return hasPrivilegedDatabase(readGhcServerEnv())
}

function allowMemory(): boolean {
  if (isDb()) return false
  return process.env.GHC_SERVER_MEMORY === "1" || process.env.NODE_ENV === "test"
}

function buildDedupe(
  userId: string,
  eventType: string,
  referenceId?: string | null,
  explicit?: string | null
): string {
  if (explicit && explicit.trim()) return explicit.trim()
  if (referenceId) return `${userId}:${eventType}:${referenceId}`
  return `${userId}:${eventType}:${Date.now()}`
}

export async function recordGhcNotification(input: {
  userId: string
  eventType: GhcNotifEventType | string
  title: string
  body: string
  referenceId?: string
  requestId?: string
  metadata?: Record<string, unknown>
  dedupeKey?: string
  expiresAt?: number
}): Promise<{ ok: boolean; idempotent?: boolean; id?: string }> {
  const userId = String(input.userId || "").trim()
  if (!userId) return { ok: false }
  const dedupeKey = buildDedupe(userId, input.eventType, input.referenceId, input.dedupeKey)

  if (isDb()) {
    const env = readGhcServerEnv()
    const url = `${env.supabaseUrl!.replace(/\/$/, "")}/rest/v1/rpc/ghc_record_notification_event`
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: env.supabaseServiceRoleKey!,
          Authorization: `Bearer ${env.supabaseServiceRoleKey!}`,
        },
        body: JSON.stringify({
          p_user_id: userId,
          p_event_type: input.eventType,
          p_title: input.title,
          p_body: input.body,
          p_reference_id: input.referenceId ?? null,
          p_request_id: input.requestId ?? null,
          p_payload: input.metadata || {},
          p_dedupe_key: dedupeKey,
          p_expires_at: input.expiresAt ? new Date(input.expiresAt).toISOString() : null,
        }),
      })
      if (!res.ok) return { ok: false }
      const data = (await res.json()) as Record<string, unknown>
      return {
        ok: data.ok === true,
        idempotent: Boolean(data.idempotent),
        id: data.id ? String(data.id) : undefined,
      }
    } catch {
      return { ok: false }
    }
  }

  if (!allowMemory()) return { ok: false }

  const existing = memoryNotifs.find((n) => n.userId === userId && n.dedupeKey === dedupeKey)
  if (existing) return { ok: true, idempotent: true, id: existing.id }

  const row: MemoryNotif = {
    id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId,
    eventType: input.eventType,
    title: input.title,
    body: input.body,
    referenceId: input.referenceId,
    requestId: input.requestId,
    metadata: input.metadata || {},
    createdAt: Date.now(),
    readAt: null,
    expiresAt: input.expiresAt ?? null,
    dedupeKey,
  }
  memoryNotifs.push(row)
  try {
    getProcessGhcStore().pushEvent(userId, input.eventType, input.metadata || {}, input.referenceId)
  } catch {
    /* */
  }
  return { ok: true, idempotent: false, id: row.id }
}

export async function listGhcNotifications(
  userId: string,
  opts?: { limit?: number; unreadOnly?: boolean }
): Promise<GhcNotificationRecord[]> {
  const limit = Math.min(opts?.limit ?? 50, 100)
  if (isDb()) {
    const env = readGhcServerEnv()
    const base = `${env.supabaseUrl!.replace(/\/$/, "")}/rest/v1/ghc_economy_events`
    const params = new URLSearchParams()
    params.set("user_id", `eq.${userId}`)
    params.set("order", "created_at.desc")
    params.set("limit", String(limit))
    if (opts?.unreadOnly) params.set("read_at", "is.null")
    try {
      const res = await fetch(`${base}?${params}`, {
        headers: {
          apikey: env.supabaseServiceRoleKey!,
          Authorization: `Bearer ${env.supabaseServiceRoleKey!}`,
        },
      })
      if (!res.ok) return []
      const rows = (await res.json()) as Array<Record<string, unknown>>
      return rows.map((r) => ({
        id: String(r.id),
        userId: String(r.user_id),
        eventType: String(r.event_type),
        title: String(r.title || r.event_type),
        body: String(r.body || ""),
        referenceId: r.reference_id ? String(r.reference_id) : undefined,
        requestId: r.request_id ? String(r.request_id) : undefined,
        metadata: (r.payload as Record<string, unknown>) || {},
        createdAt: r.created_at ? new Date(String(r.created_at)).getTime() : Date.now(),
        readAt: r.read_at ? new Date(String(r.read_at)).getTime() : null,
        expiresAt: r.expires_at ? new Date(String(r.expires_at)).getTime() : null,
        dedupeKey: r.dedupe_key ? String(r.dedupe_key) : undefined,
      }))
    } catch {
      return []
    }
  }

  if (!allowMemory()) return []
  let list = memoryNotifs.filter((n) => n.userId === userId)
  if (opts?.unreadOnly) list = list.filter((n) => !n.readAt)
  return list.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit)
}

export async function markGhcNotificationRead(
  userId: string,
  notificationId: string
): Promise<boolean> {
  if (isDb()) {
    const env = readGhcServerEnv()
    const url = `${env.supabaseUrl!.replace(/\/$/, "")}/rest/v1/ghc_economy_events?id=eq.${encodeURIComponent(notificationId)}&user_id=eq.${encodeURIComponent(userId)}`
    try {
      const res = await fetch(url, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          apikey: env.supabaseServiceRoleKey!,
          Authorization: `Bearer ${env.supabaseServiceRoleKey!}`,
          Prefer: "return=minimal",
        },
        body: JSON.stringify({ read_at: new Date().toISOString() }),
      })
      return res.ok
    } catch {
      return false
    }
  }
  if (!allowMemory()) return false
  const row = memoryNotifs.find((n) => n.id === notificationId && n.userId === userId)
  if (!row) return false
  row.readAt = Date.now()
  return true
}

export async function markAllGhcNotificationsRead(userId: string): Promise<number> {
  if (isDb()) {
    const env = readGhcServerEnv()
    const url = `${env.supabaseUrl!.replace(/\/$/, "")}/rest/v1/ghc_economy_events?user_id=eq.${encodeURIComponent(userId)}&read_at=is.null`
    try {
      const res = await fetch(url, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          apikey: env.supabaseServiceRoleKey!,
          Authorization: `Bearer ${env.supabaseServiceRoleKey!}`,
          Prefer: "return=minimal",
        },
        body: JSON.stringify({ read_at: new Date().toISOString() }),
      })
      return res.ok ? 1 : 0
    } catch {
      return 0
    }
  }
  if (!allowMemory()) return 0
  let n = 0
  for (const row of memoryNotifs) {
    if (row.userId === userId && !row.readAt) {
      row.readAt = Date.now()
      n++
    }
  }
  return n
}

export async function unreadGhcNotificationCount(userId: string): Promise<number> {
  const list = await listGhcNotifications(userId, { unreadOnly: true, limit: 100 })
  return list.length
}

/** Call after authoritative transfer success — records both sides with dedupe */
export async function notifyTransferCompleted(input: {
  senderId: string
  recipientId: string
  amount: number
  referenceId: string
  senderName?: string
  recipientName?: string
}) {
  const amt = input.amount
  await recordGhcNotification({
    userId: input.senderId,
    eventType: "GHC_SENT",
    title: "GHC sent",
    body: `${amt} GHC sent to ${input.recipientName || input.recipientId}.`,
    referenceId: input.referenceId,
    metadata: {
      amount: amt,
      currency: "GHC",
      counterpartyId: input.recipientId,
      counterpartyName: input.recipientName,
      role: "sent",
      open: "transaction",
    },
  })
  await recordGhcNotification({
    userId: input.recipientId,
    eventType: "GHC_RECEIVED",
    title: "GHC received",
    body: `You received ${amt} GHC from ${input.senderName || input.senderId}.`,
    referenceId: input.referenceId,
    metadata: {
      amount: amt,
      currency: "GHC",
      counterpartyId: input.senderId,
      counterpartyName: input.senderName,
      role: "received",
      open: "transaction",
    },
  })
}
