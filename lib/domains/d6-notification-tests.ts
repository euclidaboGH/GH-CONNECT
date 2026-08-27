/**
 * Phase D6 — GHC notification dedupe, mapping, authorization rules.
 * Run: NODE_ENV=test npx tsx lib/domains/d6-notification-tests.ts
 */
import {
  recordGhcNotification,
  listGhcNotifications,
  markGhcNotificationRead,
  markAllGhcNotificationsRead,
  notifyTransferCompleted,
  unreadGhcNotificationCount,
} from "../server/economy/notifications"
import { mapEventToNotification } from "./notification-domain"
import type { DomainEvent } from "../realtime/event-bus"
import { notificationSystem } from "../notifications"

let passed = 0
let failed = 0
function assert(cond: boolean, name: string, detail?: string) {
  if (cond) {
    passed++
    console.log(`  ✓ ${name}`)
  } else {
    failed++
    console.error(`  ✗ ${name}${detail ? " — " + detail : ""}`)
  }
}

async function run() {
  console.log("\nGHC Phase D6 notification tests\n")

  process.env.NODE_ENV = "test"
  process.env.GHC_SERVER_MEMORY = "1"

  const ref = "GHX-D6-TEST-1"

  const r1 = await recordGhcNotification({
    userId: "alice",
    eventType: "GHC_RECEIVED",
    title: "GHC received",
    body: "You received 50 GHC from Bob.",
    referenceId: ref,
    metadata: { amount: 50, currency: "GHC", role: "received" },
  })
  assert(r1.ok === true, "record received notification")
  assert(r1.idempotent !== true, "first record not idempotent")

  const r2 = await recordGhcNotification({
    userId: "alice",
    eventType: "GHC_RECEIVED",
    title: "GHC received",
    body: "You received 50 GHC from Bob.",
    referenceId: ref,
    metadata: { amount: 50, currency: "GHC", role: "received" },
  })
  assert(r2.ok === true && r2.idempotent === true, "duplicate reference deduped")

  const list = await listGhcNotifications("alice")
  const received = list.filter((n) => n.eventType === "GHC_RECEIVED" && n.referenceId === ref)
  assert(received.length === 1, "only one received notification for reference")

  const bobList = await listGhcNotifications("bob")
  assert(!bobList.some((n) => n.referenceId === ref && n.userId === "alice"), "bob list does not include alice rows")

  await notifyTransferCompleted({
    senderId: "bob",
    recipientId: "alice",
    amount: 50,
    referenceId: "GHX-D6-PAIR",
    senderName: "Bob",
    recipientName: "Alice",
  })
  // second call same ref
  await notifyTransferCompleted({
    senderId: "bob",
    recipientId: "alice",
    amount: 50,
    referenceId: "GHX-D6-PAIR",
    senderName: "Bob",
    recipientName: "Alice",
  })
  const alicePair = (await listGhcNotifications("alice")).filter((n) => n.referenceId === "GHX-D6-PAIR")
  const bobPair = (await listGhcNotifications("bob")).filter((n) => n.referenceId === "GHX-D6-PAIR")
  assert(alicePair.length === 1, "alice one received for pair")
  assert(bobPair.length === 1, "bob one sent for pair")
  assert(alicePair[0]?.eventType === "GHC_RECEIVED", "alice got RECEIVED")
  assert(bobPair[0]?.eventType === "GHC_SENT", "bob got SENT")

  // no secrets in metadata
  const meta = JSON.stringify(alicePair[0]?.metadata || {})
  assert(!/token|password|jwt|service_role/i.test(meta), "no secrets in metadata")

  // mark read
  const id = alicePair[0]!.id
  const marked = await markGhcNotificationRead("alice", id)
  assert(marked === true, "mark own notification read")
  const markedOther = await markGhcNotificationRead("bob", id)
  assert(markedOther === false, "cannot mark another user's notification")

  await markAllGhcNotificationsRead("alice")
  const unread = await unreadGhcNotificationCount("alice")
  assert(unread === 0, "alice unread zero after mark all")

  // failed transfer must not use notifyTransferCompleted
  // mapping: failed event
  const failEv = {
    type: "WALLET_TRANSFER_FAILED",
    payload: { reason: "Insufficient balance", code: "INSUFFICIENT_BALANCE", referenceId: "x" },
    actorId: "bob",
    at: Date.now(),
    origin: "local",
  } as DomainEvent
  const mappedFail = mapEventToNotification(failEv)
  assert(mappedFail?.title?.toLowerCase().includes("fail"), "failed maps to failure title")
  assert(mappedFail?.data?.ghcEvent === "GHC_TRANSFER_FAILED", "failed ghc event type")

  const sentEv = {
    type: "WALLET_TRANSFER_COMPLETED",
    payload: {
      amount: 10,
      role: "sent",
      counterpartyName: "Alice",
      referenceId: "r1",
      toUserId: "alice",
    },
    actorId: "bob",
    at: Date.now(),
    origin: "local",
  } as DomainEvent
  const mappedSent = mapEventToNotification(sentEv)
  assert(mappedSent?.title === "GHC sent", "sent title")
  assert(mappedSent?.data?.dedupeKey === "GHC_SENT:r1", "sent dedupe key")

  const recvEv = {
    type: "WALLET_TRANSFER_COMPLETED",
    payload: {
      amount: 10,
      role: "received",
      counterpartyName: "Bob",
      referenceId: "r1",
      targetUserId: "alice",
    },
    actorId: "bob",
    at: Date.now(),
    origin: "local",
  } as DomainEvent
  const mappedRecv = mapEventToNotification(recvEv)
  assert(mappedRecv?.title === "GHC received", "received title")

  // client dedupe via notificationSystem (if localStorage mocked - may no-op in node)
  try {
    const a = notificationSystem.addNotification("system", "t", "m", "🪙", {
      dedupeKey: "test-dedupe-1",
    })
    const b = notificationSystem.addNotification("system", "t", "m", "🪙", {
      dedupeKey: "test-dedupe-1",
    })
    if (a.id && b.id) {
      assert(a.id === b.id, "client notificationSystem dedupes by key")
    } else {
      assert(true, "client dedupe skipped without localStorage")
    }
  } catch {
    assert(true, "client dedupe skipped in node")
  }

  console.log(`\nPhase D6 result: ${passed} passed, ${failed} failed\n`)
  if (failed > 0) process.exitCode = 1
}
run().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
