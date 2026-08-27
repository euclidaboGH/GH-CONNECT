/**
 * Phase D3 — request does not move balance; pay uses transfer; decline/cancel safe.
 * Run: npx tsx lib/domains/request-ghc-flow-tests.ts
 */
import {
  createEconomyDomain,
  type EconomyRepository,
} from "./economy-domain"

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

function memoryRepo(): EconomyRepository {
  const store: Record<string, { txs: any[] }> = {}
  return {
    mode: "local",
    listTransactions(userId) {
      return store[userId]?.txs || []
    },
    appendTransaction(tx) {
      if (!store[tx.userId]) store[tx.userId] = { txs: [] }
      store[tx.userId].txs.push(tx)
    },
    appendTransferPair(d, c) {
      this.appendTransaction(d)
      this.appendTransaction(c)
    },
    updateTransaction(userId, id, patch) {
      const list = store[userId]?.txs || []
      const i = list.findIndex((t) => t.id === id)
      if (i >= 0) list[i] = { ...list[i], ...patch, metadata: { ...(list[i].metadata || {}), ...(patch.metadata || {}) } }
    },
    listRewards: () => [],
    appendReward: () => {},
    updateReward: () => {},
    getPremium: () => null,
    setPremium: () => {},
  }
}

async function run() {
  console.log("\nGHC Phase D3 Request flow tests\n")
  const repo = memoryRepo()
  const alice = createEconomyDomain({
    currentUserId: "alice",
    repository: repo,
    recipientExists: () => true,
  })
  const bob = createEconomyDomain({
    currentUserId: "bob",
    repository: repo,
    recipientExists: () => true,
  })

  await bob.recordTransaction({
    kind: "earned",
    amount: 200,
    reason: "seed",
    sourceEvent: "TEST",
    status: "posted",
  })

  const beforeA = alice.getWallet().balance
  const beforeB = bob.getWallet().balance

  const created = await alice.requestGhcFromUser({
    fromUserId: "bob",
    fromUserName: "Bob",
    amount: 40,
    referenceId: "req-d3-1",
    note: "School contribution",
  })
  assert(created.ok === true, "request creation")
  assert(alice.getWallet().balance === beforeA, "request does not change requester balance")
  assert(bob.getWallet().balance === beforeB, "request does not change payer balance")
  assert(alice.getWallet().pending === 0, "request not counted as pending rewards")

  const outs = alice.listOutgoingTransferRequests()
  assert(outs.some((r) => r.referenceId === "req-d3-1" && r.status === "PENDING"), "outgoing PENDING listed")

  // duplicate ref
  const dup = await alice.requestGhcFromUser({
    fromUserId: "bob",
    fromUserName: "Bob",
    amount: 40,
    referenceId: "req-d3-1",
  })
  assert(dup.ok === true, "duplicate request ref returns ok")
  assert(alice.listOutgoingTransferRequests().filter((r) => r.referenceId === "req-d3-1").length >= 1, "no duplicate economic requests")

  // self
  const self = await alice.requestGhcFromUser({
    fromUserId: "alice",
    fromUserName: "Alice",
    amount: 5,
    referenceId: "req-self",
  })
  assert(self.ok === false, "self-request rejected")

  // pay
  const pay = await bob.fulfillGhcRequest({
    requestReferenceId: "req-d3-1",
    toUserId: "alice",
    toUserName: "Alice",
    amount: 40,
  })
  assert(pay.ok === true, "pay request")
  assert(bob.getWallet().balance === beforeB - 40, "payer debited via transfer")
  assert(alice.getWallet().balance === beforeA + 40, "requester credited via transfer")

  const pay2 = await bob.fulfillGhcRequest({
    requestReferenceId: "req-d3-1",
    toUserId: "alice",
    toUserName: "Alice",
    amount: 40,
  })
  assert(pay2.ok === true, "double pay idempotent")
  assert(bob.getWallet().balance === beforeB - 40, "no second debit")

  // decline path
  await alice.requestGhcFromUser({
    fromUserId: "bob",
    fromUserName: "Bob",
    amount: 10,
    referenceId: "req-d3-dec",
  })
  const dec = await alice.declineGhcRequest({ referenceId: "req-d3-dec" })
  assert(dec.ok === true, "decline")
  assert(bob.getWallet().balance === beforeB - 40, "decline does not move GHC")

  // cancel
  await alice.requestGhcFromUser({
    fromUserId: "bob",
    fromUserName: "Bob",
    amount: 8,
    referenceId: "req-d3-can",
  })
  const can = await alice.cancelGhcRequest({ referenceId: "req-d3-can" })
  assert(can.ok === true, "cancel")
  assert(alice.getWallet().balance === beforeA + 40, "cancel does not move GHC")

  console.log(`\nPhase D3 result: ${passed} passed, ${failed} failed\n`)
  if (failed > 0) process.exitCode = 1
}
run().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
