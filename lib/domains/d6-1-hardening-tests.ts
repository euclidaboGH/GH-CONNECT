/**
 * Phase D6.1 — request notification lifecycle, dedupe, ACL, privacy.
 * Run: NODE_ENV=test GHC_SERVER_MEMORY=1 npx tsx lib/domains/d6-1-hardening-tests.ts
 */
import {
  createMemoryGhcStore,
  createTransferRequest,
  acceptTransferRequest,
  declineTransferRequest,
  cancelTransferRequest,
  expirePendingRequests,
  executeAuthoritativeTransfer,
  resetProcessGhcStoreForTests,
  getProcessGhcStore,
} from "../server/economy/store"
import {
  listGhcNotifications,
  recordGhcNotification,
} from "../server/economy/notifications"
import { mapEventToNotification } from "./notification-domain"
import type { DomainEvent } from "../realtime/event-bus"
import { createLedgerTransaction } from "./economy-ledger"
import { DEFAULT_ECONOMY_LIMITS } from "./economy-types"

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

async function seedBalance(store: ReturnType<typeof createMemoryGhcStore>, userId: string, amount: number) {
  const built = createLedgerTransaction(
    {
      userId,
      kind: "earned",
      amount,
      reason: "seed",
      sourceEvent: "TEST",
      status: "posted",
    },
    DEFAULT_ECONOMY_LIMITS
  )
  if (built.ok) store.appendPosted(built.tx)
}

async function run() {
  console.log("\nGHC Phase D6.1 hardening tests\n")
  process.env.NODE_ENV = "test"
  process.env.GHC_SERVER_MEMORY = "1"
  resetProcessGhcStoreForTests()

  const store = getProcessGhcStore()
  await seedBalance(store, "payer", 1000)
  await seedBalance(store, "requester", 0)

  // CREATE
  const created = await createTransferRequest(store, {
    requesterId: "requester",
    payerId: "payer",
    amount: 50,
    referenceId: "req-d61-1",
    note: "Test",
  })
  assert(created.ok === true, "request created")
  const payerNotifs = await listGhcNotifications("payer")
  assert(
    payerNotifs.some((n) => n.eventType === "GHC_REQUEST_CREATED" && n.referenceId === "req-d61-1"),
    "payer got REQUEST_CREATED"
  )
  const requesterNotifs0 = await listGhcNotifications("requester")
  assert(
    !requesterNotifs0.some((n) => n.eventType === "GHC_REQUEST_CREATED" && n.referenceId === "req-d61-1"),
    "requester does not get CREATED as target"
  )

  // duplicate create
  await createTransferRequest(store, {
    requesterId: "requester",
    payerId: "payer",
    amount: 50,
    referenceId: "req-d61-1",
  })
  const createdCount = (await listGhcNotifications("payer")).filter(
    (n) => n.eventType === "GHC_REQUEST_CREATED" && n.referenceId === "req-d61-1"
  ).length
  assert(createdCount === 1, "request created notification deduped")

  // DECLINE path
  const dRef = "req-d61-decline"
  await createTransferRequest(store, {
    requesterId: "requester",
    payerId: "payer",
    amount: 20,
    referenceId: dRef,
  })
  const dec = await declineTransferRequest(store, { actorId: "payer", referenceId: dRef })
  assert(dec.ok === true, "decline ok")
  const reqAfterDec = store.getRequest(dRef)
  assert(reqAfterDec?.status === "DECLINED", "status DECLINED")
  assert(
    (await listGhcNotifications("requester")).some(
      (n) => n.eventType === "GHC_REQUEST_DECLINED" && n.referenceId === dRef
    ),
    "requester got DECLINED"
  )
  assert(
    !(await listGhcNotifications("requester")).some(
      (n) => n.referenceId === dRef && (n.eventType === "GHC_SENT" || n.eventType === "GHC_RECEIVED")
    ),
    "decline has no SENT/RECEIVED"
  )
  assert(store.availableBalance("payer") === 1000, "decline no balance change")

  // CANCEL path
  const cRef = "req-d61-cancel"
  await createTransferRequest(store, {
    requesterId: "requester",
    payerId: "payer",
    amount: 15,
    referenceId: cRef,
  })
  const can = await cancelTransferRequest(store, { actorId: "requester", referenceId: cRef })
  assert(can.ok === true, "cancel ok")
  assert(store.getRequest(cRef)?.status === "CANCELLED", "status CANCELLED")
  assert(
    (await listGhcNotifications("payer")).some(
      (n) => n.eventType === "GHC_REQUEST_CANCELLED" && n.referenceId === cRef
    ),
    "payer got CANCELLED"
  )

  // ACCEPT path
  const aRef = "req-d61-accept"
  await createTransferRequest(store, {
    requesterId: "requester",
    payerId: "payer",
    amount: 40,
    referenceId: aRef,
  })
  const beforePayer = store.availableBalance("payer")
  const beforeReq = store.availableBalance("requester")
  const acc = await acceptTransferRequest(store, { actorId: "payer", referenceId: aRef })
  assert(acc.ok === true, "accept ok")
  assert(store.getRequest(aRef)?.status === "ACCEPTED", "status ACCEPTED after transfer")
  assert(store.availableBalance("payer") === beforePayer - 40, "payer debited")
  assert(store.availableBalance("requester") === beforeReq + 40, "requester credited")

  const reqNotifs = await listGhcNotifications("requester")
  assert(
    reqNotifs.some((n) => n.eventType === "GHC_REQUEST_ACCEPTED" && n.referenceId === aRef),
    "requester got REQUEST_ACCEPTED"
  )
  assert(
    reqNotifs.some((n) => n.eventType === "GHC_RECEIVED" && n.referenceId === aRef),
    "requester got RECEIVED"
  )
  assert(
    (await listGhcNotifications("payer")).some(
      (n) => n.eventType === "GHC_SENT" && n.referenceId === aRef
    ),
    "payer got SENT"
  )

  // accept again — no double money / no double notifs
  const acc2 = await acceptTransferRequest(store, { actorId: "payer", referenceId: aRef })
  assert(acc2.ok === true, "second accept idempotent-ish")
  assert(store.availableBalance("payer") === beforePayer - 40, "no second debit")
  const sentCount = (await listGhcNotifications("payer")).filter(
    (n) => n.eventType === "GHC_SENT" && n.referenceId === aRef
  ).length
  assert(sentCount === 1, "SENT notification not duplicated")

  // EXPIRE
  const eRef = "req-d61-exp"
  await createTransferRequest(store, {
    requesterId: "requester",
    payerId: "payer",
    amount: 5,
    referenceId: eRef,
  })
  const expReq = store.getRequest(eRef)!
  store.saveRequest({ ...expReq, expiresAt: Date.now() - 1000 })
  const expiredN = await expirePendingRequests(store)
  assert(expiredN >= 1, "expired at least one")
  assert(store.getRequest(eRef)?.status === "EXPIRED", "status EXPIRED")
  assert(
    (await listGhcNotifications("requester")).some(
      (n) => n.eventType === "GHC_REQUEST_EXPIRED" && n.referenceId === eRef
    ),
    "requester got EXPIRED"
  )
  // cannot pay expired
  const payExp = await acceptTransferRequest(store, { actorId: "payer", referenceId: eRef })
  assert(payExp.ok === false, "cannot pay expired")

  // Failed transfer notification mapping privacy
  const failMap = mapEventToNotification({
    type: "WALLET_TRANSFER_FAILED",
    payload: { reason: "Insufficient balance", code: "INSUFFICIENT_BALANCE", referenceId: "f1" },
    actorId: "payer",
    at: Date.now(),
    origin: "local",
  } as DomainEvent)
  assert(!!failMap && !/token|sql|stack/i.test(JSON.stringify(failMap)), "failure mapping safe")

  // Privacy: no secrets in request notification metadata
  for (const n of await listGhcNotifications("payer")) {
    const s = JSON.stringify(n)
    assert(!/access_token|service_role|password|jwt/i.test(s), "no secrets in payer notifs")
  }

  // Cross-user: cannot invent reading other user via list (API enforces auth; store is per-user list)
  const onlyPayer = await listGhcNotifications("payer")
  assert(onlyPayer.every((n) => n.userId === "payer"), "list is user-scoped")

  // Direct transfer still works
  const xfer = await executeAuthoritativeTransfer(store, {
    senderId: "payer",
    toUserId: "requester",
    amount: 10,
    referenceId: "p2p-d61-1",
  })
  assert(xfer.ok === true, "direct transfer ok")

  console.log(`\nPhase D6.1 result: ${passed} passed, ${failed} failed\n`)
  if (failed > 0) process.exitCode = 1
}
run().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
