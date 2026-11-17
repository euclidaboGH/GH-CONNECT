/**
 * Phase D6.1 — request lifecycle → user-facing GHC notifications.
 * Only call after authoritative state changes succeed.
 */

import { recordGhcNotification, notifyTransferCompleted } from "./notifications"

function amt(n: number) {
  return Number.isFinite(n) ? String(n) : "GHC"
}

/** After request row is PENDING — notify payer only */
export async function notifyRequestCreated(input: {
  requesterId: string
  payerId: string
  amount: number
  referenceId: string
  requesterName?: string
  note?: string
}) {
  await recordGhcNotification({
    userId: input.payerId,
    eventType: "GHC_REQUEST_CREATED",
    title: "GHC request",
    body: `${input.requesterName || "Someone"} requested ${amt(input.amount)} GHC from you.`,
    referenceId: input.referenceId,
    requestId: input.referenceId,
    metadata: {
      amount: input.amount,
      currency: "GHC",
      counterpartyId: input.requesterId,
      counterpartyName: input.requesterName,
      note: input.note,
      open: "requests",
      role: "incoming_request",
    },
  })
}

/** After transfer succeeds and request is ACCEPTED */
export async function notifyRequestAccepted(input: {
  requesterId: string
  payerId: string
  amount: number
  referenceId: string
  requesterName?: string
  payerName?: string
}) {
  await recordGhcNotification({
    userId: input.requesterId,
    eventType: "GHC_REQUEST_ACCEPTED",
    title: "Request accepted",
    body: `Your ${amt(input.amount)} GHC request was accepted.`,
    referenceId: input.referenceId,
    requestId: input.referenceId,
    metadata: {
      amount: input.amount,
      currency: "GHC",
      open: "transaction",
      role: "requester",
    },
  })
  // Transfer legs (SENT/RECEIVED) — deduped by referenceId
  await notifyTransferCompleted({
    senderId: input.payerId,
    recipientId: input.requesterId,
    amount: input.amount,
    referenceId: input.referenceId,
    senderName: input.payerName,
    recipientName: input.requesterName,
  })
}

export async function notifyRequestDeclined(input: {
  requesterId: string
  payerId: string
  amount: number
  referenceId: string
  payerName?: string
}) {
  await recordGhcNotification({
    userId: input.requesterId,
    eventType: "GHC_REQUEST_DECLINED",
    title: "Request declined",
    body: `${input.payerName || "The other member"} declined your ${amt(input.amount)} GHC request.`,
    referenceId: input.referenceId,
    requestId: input.referenceId,
    metadata: {
      amount: input.amount,
      currency: "GHC",
      open: "requests",
      role: "requester",
    },
  })
}

export async function notifyRequestCancelled(input: {
  requesterId: string
  payerId: string
  amount: number
  referenceId: string
  requesterName?: string
}) {
  await recordGhcNotification({
    userId: input.payerId,
    eventType: "GHC_REQUEST_CANCELLED",
    title: "Request cancelled",
    body: `${input.requesterName || "Someone"} cancelled the ${amt(input.amount)} GHC request.`,
    referenceId: input.referenceId,
    requestId: input.referenceId,
    metadata: {
      amount: input.amount,
      currency: "GHC",
      open: "requests",
      role: "payer",
    },
  })
}

export async function notifyRequestExpired(input: {
  requesterId: string
  payerId: string
  amount: number
  referenceId: string
}) {
  const body = `The ${amt(input.amount)} GHC request has expired.`
  await recordGhcNotification({
    userId: input.requesterId,
    eventType: "GHC_REQUEST_EXPIRED",
    title: "Request expired",
    body,
    referenceId: input.referenceId,
    requestId: input.referenceId,
    metadata: { amount: input.amount, currency: "GHC", open: "requests" },
  })
  await recordGhcNotification({
    userId: input.payerId,
    eventType: "GHC_REQUEST_EXPIRED",
    title: "Request expired",
    body,
    referenceId: input.referenceId,
    requestId: input.referenceId,
    metadata: { amount: input.amount, currency: "GHC", open: "requests" },
  })
}

export async function notifyTransferFailedEvent(input: {
  userId: string
  referenceId: string
  reason: string
  code?: string
}) {
  await recordGhcNotification({
    userId: input.userId,
    eventType: "GHC_TRANSFER_FAILED",
    title: "GHC transfer failed",
    body: input.reason || "Your GHC transfer could not be completed.",
    referenceId: input.referenceId,
    metadata: {
      code: input.code,
      open: "transaction",
    },
    dedupeKey: `${input.userId}:GHC_TRANSFER_FAILED:${input.referenceId}:${input.code || "fail"}`,
  })
}
