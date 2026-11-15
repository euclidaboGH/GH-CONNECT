import { readGhcServerEnv } from "@/lib/server/economy/env"
import { randomUUID } from "node:crypto"

export type UnifiedNotificationRow = {
  id: string
  recipientUserId: string
  actorUserId?: string | null
  sourceType: string
  sourceId?: string | null
  type: string
  title: string
  body: string
  metadata: Record<string, unknown>
  correlationId?: string | null
  requestId?: string | null
  readAt?: string | null
  createdAt: string
  expiresAt?: string | null
}

async function rpc(name: string, body: Record<string, unknown>) {
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return { ok: false, data: null as any, error: "DB_UNAVAILABLE" }
  try {
    const res = await fetch(`${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: env.supabaseServiceRoleKey,
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) return { ok: false, data, error: `HTTP_${res.status}` }
    return { ok: data?.ok !== false, data, error: data?.error ? String(data.error) : undefined }
  } catch {
    return { ok: false, data: null as any, error: "RPC_FAILED" }
  }
}

export async function listUnifiedNotifications(userId: string, opts?: {
  limit?: number
  beforeCreatedAt?: string | null
  beforeId?: string | null
  unreadOnly?: boolean
}) {
  return rpc("gh_notification_inbox_list", {
    p_recipient_user_id: userId,
    p_limit: Math.min(Math.max(opts?.limit ?? 60, 1), 100),
    p_before_created_at: opts?.beforeCreatedAt ?? null,
    p_before_id: opts?.beforeId ?? null,
    p_unread_only: Boolean(opts?.unreadOnly),
  })
}

export async function unifiedUnreadCount(userId: string) {
  return rpc("gh_notification_inbox_unread_count", { p_recipient_user_id: userId })
}

export async function markUnifiedNotificationsRead(userId: string, opts: { ids?: string[]; all?: boolean }) {
  return rpc("gh_notification_inbox_mark_read", {
    p_recipient_user_id: userId,
    p_ids: opts.ids?.slice(0, 100) ?? null,
    p_all: Boolean(opts.all),
  })
}


export async function createUnifiedNotification(input: {
  recipientUserId: string
  actorUserId?: string | null
  sourceType: string
  sourceId?: string | null
  notificationType: string
  title: string
  body: string
  dedupeKey: string
  requestId?: string | null
  correlationId?: string | null
  metadata?: Record<string, unknown>
  expiresAt?: string | null
}): Promise<{ ok: boolean; id?: string; idempotent?: boolean }> {
  const recipientUserId = String(input.recipientUserId || "").trim()
  const dedupeKey = String(input.dedupeKey || "").trim()
  const notificationType = String(input.notificationType || "").trim().toLowerCase()
  if (!recipientUserId || !dedupeKey || !notificationType) return { ok: false }
  const id = `notif_${randomUUID().replace(/-/g, "")}`
  const result = await rpc("gh_notification_inbox_create", {
    p_id: id,
    p_recipient_user_id: recipientUserId,
    p_actor_user_id: input.actorUserId ?? null,
    p_source_type: input.sourceType || "system",
    p_source_id: input.sourceId ?? null,
    p_notification_type: notificationType,
    p_title: String(input.title || "GreenHaven update").slice(0, 200),
    p_body: String(input.body || "").slice(0, 500),
    p_metadata: input.metadata ?? {},
    p_correlation_id: input.correlationId ?? null,
    p_request_id: input.requestId ?? null,
    p_dedupe_key: dedupeKey,
    p_expires_at: input.expiresAt ?? null,
  })
  if (!result.ok || !result.data || result.data.ok !== true) return { ok: false }
  if (result.data.skipped === true) return { ok: true, idempotent: true }
  const savedId = typeof result.data.id === "string" ? result.data.id : id
  const idempotent = Boolean(result.data.idempotent)
  if (!idempotent) {
    await appendRealtimeEvent({
      eventId: `notification-created:${recipientUserId}:${dedupeKey}`,
      recipientUserId,
      actorUserId: input.actorUserId ?? null,
      eventType: "NOTIFICATION_CREATED",
      aggregateType: input.sourceType || "system",
      aggregateId: input.sourceId ?? null,
      correlationId: input.correlationId ?? null,
      requestId: input.requestId ?? null,
      payload: { notificationId: savedId, notificationType },
      expiresAt: input.expiresAt ?? null,
    }).catch(() => ({ ok: false }))
  }
  return { ok: true, id: savedId, idempotent }
}



export async function notifyVerifiedPaymentIntent(input: {
  recipientUserId: string
  intent: {
    id: string
    userId: string
    status?: string | null
    purpose?: string | null
    currency?: string | null
    amount?: number | null
    referenceId?: string | null
    providerPaymentId?: string | null
    txid?: string | null
    metadata?: Record<string, unknown> | null
  }
  paymentId?: string | null
  txid?: string | null
}): Promise<{ ok: boolean; id?: string; idempotent?: boolean }> {
  if (!input.intent?.id || input.intent.userId !== input.recipientUserId) return { ok: false }
  const status = String(input.intent.status || "").toUpperCase()
  if (status && status !== "COMPLETED" && status !== "FULFILLED") return { ok: false }
  const meta = (input.intent.metadata || {}) as Record<string, unknown>
  const transactionId = input.txid || input.intent.txid || undefined
  const paymentId = input.paymentId || input.intent.providerPaymentId || undefined
  return createUnifiedNotification({
    recipientUserId: input.recipientUserId,
    actorUserId: null,
    sourceType: "payment",
    sourceId: input.intent.id,
    notificationType: "pi_payment_completed",
    title: "Pi payment confirmed",
    body: `Your ${input.intent.currency || "Pi"} payment was confirmed by the payment service.`,
    dedupeKey: `pi-payment-completed:${input.intent.id}`,
    requestId: input.intent.id,
    metadata: {
      paymentIntentId: input.intent.id,
      paymentId,
      transactionId,
      referenceId: input.intent.referenceId,
      purpose: input.intent.purpose,
      currency: input.intent.currency,
      amount: input.intent.amount,
      listingId: typeof meta.listingId === "string" ? meta.listingId : undefined,
      orderId: typeof meta.orderId === "string" ? meta.orderId : undefined,
      postId: typeof meta.postId === "string" ? meta.postId : undefined,
      deepLink: {
        open: "wallet", tab: "wallet", section: "payment",
        paymentIntentId: input.intent.id, transactionId, referenceId: input.intent.referenceId || undefined,
      },
    },
  })
}

export async function notifyMarketplaceOrderPaid(input: {
  order: { id: string; buyerId: string; sellerId: string; listingId?: string | null }
  actorUserId?: string | null
  paymentIntentId?: string | null
  paymentMethod?: "pi" | "ghc"
}): Promise<void> {
  const order = input.order
  if (!order?.id || !order.buyerId || !order.sellerId) return
  if (input.actorUserId && input.actorUserId !== order.buyerId) return
  const listingId = order.listingId || undefined
  const metadata = {
    orderId: order.id,
    listingId,
    paymentIntentId: input.paymentIntentId || undefined,
    paymentMethod: input.paymentMethod || undefined,
    deepLink: { open: "marketplace", tab: "home", section: "order", orderId: order.id, listingId },
  }
  await Promise.all([
    createUnifiedNotification({
      recipientUserId: order.sellerId,
      actorUserId: input.actorUserId || order.buyerId,
      sourceType: "marketplace",
      sourceId: order.id,
      notificationType: "marketplace_order_paid",
      title: "Marketplace order paid",
      body: input.paymentMethod === "pi" ? "A buyer’s Pi payment was verified for your listing." : "A buyer’s GHC payment was verified for your listing.",
      dedupeKey: `marketplace-order-paid:${order.id}:seller`,
      requestId: input.paymentIntentId || null,
      metadata,
    }),
    createUnifiedNotification({
      recipientUserId: order.buyerId,
      actorUserId: null,
      sourceType: "marketplace",
      sourceId: order.id,
      notificationType: "marketplace_payment_completed",
      title: "Marketplace payment confirmed",
      body: "Your payment was verified and the order is confirmed.",
      dedupeKey: `marketplace-order-paid:${order.id}:buyer`,
      requestId: input.paymentIntentId || null,
      metadata,
    }),
  ]).then(() => undefined).catch(() => undefined)
}

export async function appendRealtimeEvent(input: {
  eventId: string
  recipientUserId: string
  actorUserId?: string | null
  eventType: string
  aggregateType?: string
  aggregateId?: string | null
  correlationId?: string | null
  requestId?: string | null
  payload?: Record<string, unknown>
  expiresAt?: string | null
}) {
  return rpc("gh_notification_event_append", {
    p_event_id: input.eventId,
    p_recipient_user_id: input.recipientUserId,
    p_actor_user_id: input.actorUserId ?? null,
    p_event_type: input.eventType,
    p_aggregate_type: input.aggregateType ?? "system",
    p_aggregate_id: input.aggregateId ?? null,
    p_correlation_id: input.correlationId ?? null,
    p_request_id: input.requestId ?? null,
    p_payload: input.payload ?? {},
    p_expires_at: input.expiresAt ?? null,
  })
}
