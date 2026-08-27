/**
 * Phase A — domain ledger tests for GHC internal P2P.
 * Run: npx tsx lib/domains/economy-p2p-tests.ts
 * Verifies ledger outcomes, not UI state.
 */

import {
  createEconomyDomain,
  createLocalEconomyRepository,
  type EconomyRepository,
} from "./economy-domain"
import { computeWalletFromLedger } from "./economy-ledger"
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

function memoryRepo(): EconomyRepository {
  // Isolate from browser localStorage
  const store: Record<string, { txs: any[]; rewards: any[]; premium: any }> = {}
  const base = createLocalEconomyRepository()
  return {
    listTransactions(userId) {
      return store[userId]?.txs || []
    },
    appendTransaction(tx) {
      if (!store[tx.userId]) store[tx.userId] = { txs: [], rewards: [], premium: null }
      store[tx.userId].txs.push(tx)
    },
    appendTransferPair(debit, credit) {
      this.appendTransaction(debit)
      this.appendTransaction(credit)
    },
    updateTransaction(userId, id, patch) {
      const list = store[userId]?.txs || []
      const idx = list.findIndex((t) => t.id === id)
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...patch, metadata: { ...(list[idx].metadata || {}), ...(patch.metadata || {}) } }
      }
    },
    listRewards(userId) {
      return store[userId]?.rewards || []
    },
    appendReward(reward) {
      if (!store[reward.userId]) store[reward.userId] = { txs: [], rewards: [], premium: null }
      store[reward.userId].rewards.push(reward)
    },
    updateReward() {},
    getPremium() {
      return null
    },
    setPremium() {},
  }
}

async function seedBalance(eco: ReturnType<typeof createEconomyDomain>, amount: number) {
  await eco.recordTransaction({
    kind: "earned",
    amount,
    reason: "Test seed",
    sourceEvent: "TEST_SEED",
    status: "posted",
  })
}

async function run() {
  console.log("\nGHC P2P Phase A domain tests\n")

  // --- successful send ---
  {
    const repo = memoryRepo()
    const blocked = new Set<string>()
    const eco = createEconomyDomain({
      currentUserId: "alice",
      repository: repo,
      isBlockedEitherWay: (id) => blocked.has(id),
      recipientExists: () => true,
    })
    await seedBalance(eco, 100)
    const res = await eco.sendGhcToUser({
      toUserId: "bob",
      toUserName: "Bob",
      amount: 10,
      note: "Thanks",
      referenceId: "ref-send-1",
    })
    assert(res.ok === true, "successful send")
    const w = eco.getWallet()
    assert(w.balance === 90, "sender debit 10", `bal=${w.balance}`)
    const bobBal = computeWalletFromLedger("bob", repo.listTransactions("bob"), DEFAULT_ECONOMY_LIMITS)
    assert(bobBal.balance === 10, "recipient credit 10", `bal=${bobBal.balance}`)
    const out = repo.listTransactions("alice").find((t) => t.kind === "transfer_out")
    const inn = repo.listTransactions("bob").find((t) => t.kind === "transfer_in")
    assert(!!out && !!inn && out!.referenceId === inn!.referenceId, "matching transfer reference")
  }

  // --- insufficient balance ---
  {
    const eco = createEconomyDomain({
      currentUserId: "alice",
      repository: memoryRepo(),
      recipientExists: () => true,
    })
    await seedBalance(eco, 5)
    const res = await eco.sendGhcToUser({
      toUserId: "bob",
      toUserName: "Bob",
      amount: 20,
      referenceId: "ref-insuf",
    })
    assert(res.ok === false, "insufficient balance rejected")
    assert(eco.getWallet().balance === 5, "balance unchanged after failed send")
  }

  // --- self-transfer ---
  {
    const eco = createEconomyDomain({
      currentUserId: "alice",
      repository: memoryRepo(),
      recipientExists: () => true,
    })
    await seedBalance(eco, 50)
    const res = await eco.sendGhcToUser({
      toUserId: "alice",
      toUserName: "Alice",
      amount: 5,
    })
    assert(res.ok === false, "self-transfer rejection")
  }

  // --- blocked ---
  {
    const blocked = new Set(["bob"])
    const eco = createEconomyDomain({
      currentUserId: "alice",
      repository: memoryRepo(),
      isBlockedEitherWay: (id) => blocked.has(id),
      recipientExists: () => true,
    })
    await seedBalance(eco, 50)
    const res = await eco.sendGhcToUser({
      toUserId: "bob",
      toUserName: "Bob",
      amount: 5,
    })
    assert(res.ok === false, "blocked-user rejection")
    assert(eco.getWallet().balance === 50, "no debit when blocked")
  }

  // --- invalid amount ---
  {
    const eco = createEconomyDomain({
      currentUserId: "alice",
      repository: memoryRepo(),
      recipientExists: () => true,
    })
    await seedBalance(eco, 50)
    const res = await eco.sendGhcToUser({
      toUserId: "bob",
      toUserName: "Bob",
      amount: 0,
    })
    assert(res.ok === false, "invalid amount rejection")
  }

  // --- idempotent send ---
  {
    const eco = createEconomyDomain({
      currentUserId: "alice",
      repository: memoryRepo(),
      recipientExists: () => true,
    })
    await seedBalance(eco, 100)
    const a = await eco.sendGhcToUser({
      toUserId: "bob",
      toUserName: "Bob",
      amount: 7,
      referenceId: "idem-1",
    })
    const b = await eco.sendGhcToUser({
      toUserId: "bob",
      toUserName: "Bob",
      amount: 7,
      referenceId: "idem-1",
    })
    assert(a.ok && b.ok, "duplicate send returns ok")
    assert(eco.getWallet().balance === 93, "idempotent send single debit", `bal=${eco.getWallet().balance}`)
  }

  // --- request create does not move balance ---
  {
    const eco = createEconomyDomain({
      currentUserId: "alice",
      repository: memoryRepo(),
      recipientExists: () => true,
    })
    await seedBalance(eco, 40)
    const res = await eco.requestGhcFromUser({
      fromUserId: "bob",
      fromUserName: "Bob",
      amount: 15,
      referenceId: "req-1",
    })
    assert(res.ok === true, "request creation")
    assert(eco.getWallet().balance === 40, "request does not change available")
    assert(eco.getWallet().pending === 0, "request not counted as pending rewards", `p=${eco.getWallet().pending}`)
    const outs = eco.listOutgoingTransferRequests()
    assert(outs.length === 1 && outs[0].status === "PENDING", "outgoing PENDING request listed")
  }

  // --- fulfill / accept ---
  {
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
    await seedBalance(bob, 80)
    await alice.requestGhcFromUser({
      fromUserId: "bob",
      fromUserName: "Bob",
      amount: 12,
      referenceId: "req-pay-1",
    })
    const pay = await bob.fulfillGhcRequest({
      requestReferenceId: "req-pay-1",
      toUserId: "alice",
      toUserName: "Alice",
      amount: 12,
    })
    assert(pay.ok === true, "request acceptance/pay")
    assert(bob.getWallet().balance === 68, "payer debited on accept", `bal=${bob.getWallet().balance}`)
    assert(alice.getWallet().balance === 12, "requester credited on accept", `bal=${alice.getWallet().balance}`)

    const pay2 = await bob.fulfillGhcRequest({
      requestReferenceId: "req-pay-1",
      toUserId: "alice",
      toUserName: "Alice",
      amount: 12,
    })
    assert(pay2.ok === true, "duplicate fulfillment idempotent")
    assert(bob.getWallet().balance === 68, "no double pay", `bal=${bob.getWallet().balance}`)
  }

  // --- decline / cancel ---
  {
    const eco = createEconomyDomain({
      currentUserId: "alice",
      repository: memoryRepo(),
      recipientExists: () => true,
    })
    await eco.requestGhcFromUser({
      fromUserId: "bob",
      fromUserName: "Bob",
      amount: 3,
      referenceId: "req-dec",
    })
    const d = await eco.declineGhcRequest({ referenceId: "req-dec" })
    assert(d.ok === true, "request decline")
    assert(eco.getWallet().balance === 0, "decline does not change balance")

    await eco.requestGhcFromUser({
      fromUserId: "bob",
      fromUserName: "Bob",
      amount: 4,
      referenceId: "req-can",
    })
    const c = await eco.cancelGhcRequest({ referenceId: "req-can" })
    assert(c.ok === true, "request cancellation")
  }

  // --- pending reward cannot be transferred ---
  {
    const eco = createEconomyDomain({
      currentUserId: "alice",
      repository: memoryRepo(),
      recipientExists: () => true,
    })
    await eco.recordTransaction({
      kind: "pending",
      amount: 40,
      reason: "Pending reward hold",
      sourceEvent: "REWARD_PENDING",
      status: "pending",
    })
    const w = eco.getWallet()
    assert(w.balance === 0 && w.pending === 40, "pending reward not available")
    const res = await eco.sendGhcToUser({
      toUserId: "bob",
      toUserName: "Bob",
      amount: 10,
    })
    assert(res.ok === false, "cannot send from pending-only balance")
  }

  // --- transfer limit enforcement ---
  {
    const eco = createEconomyDomain({
      currentUserId: "alice",
      repository: memoryRepo(),
      recipientExists: () => true,
      limits: { ...DEFAULT_ECONOMY_LIMITS, maximumTransferAmount: 50, minimumTransferAmount: 2 },
    })
    await seedBalance(eco, 200)
    const hi = await eco.sendGhcToUser({
      toUserId: "bob",
      toUserName: "Bob",
      amount: 51,
    })
    assert(hi.ok === false, "max transfer limit enforced")
    const lo = await eco.sendGhcToUser({
      toUserId: "bob",
      toUserName: "Bob",
      amount: 1,
    })
    assert(lo.ok === false, "min transfer limit enforced")
  }

  // --- membership spend still works ---
  {
    const eco = createEconomyDomain({
      currentUserId: "alice",
      repository: memoryRepo(),
    })
    await seedBalance(eco, 300)
    const spend = await eco.spend({
      amount: 50,
      reason: "Membership test",
      sourceEvent: "PREMIUM_PURCHASE",
      referenceId: "mem-1",
    })
    assert(spend.ok === true, "membership spending pathway intact")
    assert(eco.getWallet().balance === 250, "spend debit correct")
  }

  // --- reward recordTransaction still works ---
  {
    const eco = createEconomyDomain({
      currentUserId: "alice",
      repository: memoryRepo(),
    })
    const r = await eco.recordTransaction({
      kind: "earned",
      amount: 25,
      reason: "Profile completion",
      sourceEvent: "ONBOARDING_COMPLETED",
      status: "posted",
    })
    assert(r.ok === true, "existing reward credit pathway intact")
    assert(eco.getWallet().balance === 25, "earned balance correct")
  }

  console.log(`\nResult: ${passed} passed, ${failed} failed\n`)
  if (failed > 0) process.exitCode = 1
}

run().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
