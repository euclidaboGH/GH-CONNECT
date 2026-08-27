/**
 * Phase D6.2 — transfer-request server authority (memory parity + state machine).
 * Full SQL RPCs require applied migration; memory store mirrors rules.
 * Run: NODE_ENV=test GHC_SERVER_MEMORY=1 npx tsx lib/domains/d6-2-request-db-tests.ts
 */
import {
  resetProcessGhcStoreForTests,
  getProcessGhcStore,
  createTransferRequest,
  acceptTransferRequest,
  declineTransferRequest,
  cancelTransferRequest,
  expirePendingRequests,
  executeAuthoritativeTransfer,
} from "../server/economy/store"
import { listGhcNotifications } from "../server/economy/notifications"
import { createLedgerTransaction } from "./economy-ledger"
import { DEFAULT_ECONOMY_LIMITS } from "./economy-types"
import { hasPrivilegedDatabase, readGhcServerEnv } from "../server/economy/env"
import {
  rpcCreateTransferRequest,
  rpcAcceptTransferRequest,
  rpcDeclineTransferRequest,
  rpcCancelTransferRequest,
  rpcListTransferRequests,
} from "../server/economy/db"

function isDatabaseConfigured() {
  return hasPrivilegedDatabase(readGhcServerEnv())
}
function allowMemoryServer() {
  if (isDatabaseConfigured()) return false
  return process.env.GHC_SERVER_MEMORY === "1" || process.env.NODE_ENV === "test"
}

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

async function seed(userId: string, amount: number) {
  const store = getProcessGhcStore()
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
  console.log("\nGHC Phase D6.2 transfer-request authority tests\n")
  process.env.NODE_ENV = "test"
  process.env.GHC_SERVER_MEMORY = "1"
  resetProcessGhcStoreForTests()
  const store = getProcessGhcStore()
  await seed("payer", 500)
  await seed("requester", 0)

  // Mode flags
  assert(typeof isDatabaseConfigured() === "boolean", "isDatabaseConfigured is boolean")
  assert(allowMemoryServer() === true || isDatabaseConfigured(), "memory allowed in test or DB configured")

  // When DB not configured, RPC helpers return null (no silent success)
  if (!isDatabaseConfigured()) {
    const r = await rpcCreateTransferRequest({
      requesterId: "requester",
      payerId: "payer",
      amount: 10,
      referenceId: "rpc-null-1",
    })
    assert(r === null, "RPC create returns null without DB credentials")
    assert((await rpcAcceptTransferRequest({ actorId: "payer", referenceId: "x" })) === null, "RPC accept null without DB")
    assert((await rpcDeclineTransferRequest({ actorId: "payer", referenceId: "x" })) === null, "RPC decline null without DB")
    assert((await rpcCancelTransferRequest({ actorId: "requester", referenceId: "x" })) === null, "RPC cancel null without DB")
    assert((await rpcListTransferRequests("payer")) === null, "RPC list null without DB")
  }

  // CREATE
  const c = await createTransferRequest(store, {
    requesterId: "requester",
    payerId: "payer",
    amount: 50,
    referenceId: "d62-req-1",
  })
  assert(c.ok === true, "create request")
  assert(c.ok && c.request.status === "PENDING", "status PENDING")

  // self rejected
  const self = await createTransferRequest(store, {
    requesterId: "payer",
    payerId: "payer",
    amount: 10,
    referenceId: "d62-self",
  })
  assert(self.ok === false && self.code === "SELF_TRANSFER", "self-request rejected")

  // unauthorized accept (requester tries)
  const badAccept = await acceptTransferRequest(store, {
    actorId: "requester",
    referenceId: "d62-req-1",
  })
  assert(badAccept.ok === false, "only payer may accept")

  // concurrent-style double accept
  const a1 = await acceptTransferRequest(store, { actorId: "payer", referenceId: "d62-req-1" })
  const a2 = await acceptTransferRequest(store, { actorId: "payer", referenceId: "d62-req-1" })
  assert(a1.ok === true, "first accept succeeds")
  assert(a2.ok === true, "second accept idempotent success")
  assert(store.availableBalance("payer") === 450, "single debit")
  assert(store.availableBalance("requester") === 50, "single credit")
  const sent = (await listGhcNotifications("payer")).filter(
    (n) => n.eventType === "GHC_SENT" && n.referenceId === "d62-req-1"
  )
  assert(sent.length === 1, "one SENT notification")
  const recv = (await listGhcNotifications("requester")).filter(
    (n) => n.eventType === "GHC_RECEIVED" && n.referenceId === "d62-req-1"
  )
  assert(recv.length === 1, "one RECEIVED notification")
  assert(store.getRequest("d62-req-1")?.status === "ACCEPTED", "ACCEPTED")

  // decline path
  await createTransferRequest(store, {
    requesterId: "requester",
    payerId: "payer",
    amount: 10,
    referenceId: "d62-dec",
  })
  const badDec = await declineTransferRequest(store, {
    actorId: "requester",
    referenceId: "d62-dec",
  })
  assert(badDec.ok === false, "requester cannot decline")
  const dec = await declineTransferRequest(store, {
    actorId: "payer",
    referenceId: "d62-dec",
  })
  assert(dec.ok === true, "payer decline")
  assert(store.getRequest("d62-dec")?.status === "DECLINED", "DECLINED")
  const payDeclined = await acceptTransferRequest(store, {
    actorId: "payer",
    referenceId: "d62-dec",
  })
  assert(payDeclined.ok === false, "cannot accept declined")

  // cancel path
  await createTransferRequest(store, {
    requesterId: "requester",
    payerId: "payer",
    amount: 8,
    referenceId: "d62-can",
  })
  const badCan = await cancelTransferRequest(store, {
    actorId: "payer",
    referenceId: "d62-can",
  })
  assert(badCan.ok === false, "payer cannot cancel")
  const can = await cancelTransferRequest(store, {
    actorId: "requester",
    referenceId: "d62-can",
  })
  assert(can.ok === true, "requester cancel")
  assert(store.getRequest("d62-can")?.status === "CANCELLED", "CANCELLED")

  // expiry
  await createTransferRequest(store, {
    requesterId: "requester",
    payerId: "payer",
    amount: 5,
    referenceId: "d62-exp",
  })
  const er = store.getRequest("d62-exp")!
  store.saveRequest({ ...er, expiresAt: Date.now() - 1 })
  await expirePendingRequests(store)
  assert(store.getRequest("d62-exp")?.status === "EXPIRED", "EXPIRED")
  assert(
    (await acceptTransferRequest(store, { actorId: "payer", referenceId: "d62-exp" })).ok === false,
    "cannot accept expired"
  )

  // insufficient balance on accept (amount within max limit but over available)
  const bal = store.availableBalance("payer")
  const over = bal + 50
  const createdBig = await createTransferRequest(store, {
    requesterId: "requester",
    payerId: "payer",
    amount: over,
    referenceId: "d62-big",
  })
  assert(createdBig.ok === true, "over-balance request can be created")
  const big = await acceptTransferRequest(store, {
    actorId: "payer",
    referenceId: "d62-big",
  })
  assert(big.ok === false, "insufficient balance reject")
  assert(store.getRequest("d62-big")?.status === "PENDING", "still PENDING after failed accept")

  // listing isolation
  const incoming = store.listRequests("payer", "incoming")
  assert(incoming.every((r) => r.payerId === "payer"), "incoming only payer")
  const outgoing = store.listRequests("requester", "outgoing")
  assert(outgoing.every((r) => r.requesterId === "requester"), "outgoing only requester")

  // direct transfer still ok
  const x = await executeAuthoritativeTransfer(store, {
    senderId: "payer",
    toUserId: "requester",
    amount: 1,
    referenceId: "d62-p2p",
  })
  assert(x.ok === true, "direct transfer still works")

  // DB mode: no silent local when configured without RPC is environment-dependent
  assert(
    isDatabaseConfigured() === false || typeof rpcAcceptTransferRequest === "function",
    "RPC functions exported for DB mode"
  )

  console.log(`\nPhase D6.2 result: ${passed} passed, ${failed} failed\n`)
  if (failed > 0) process.exitCode = 1
}
run().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
