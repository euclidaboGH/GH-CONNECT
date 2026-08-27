/**
 * Phase D2 — Send flow pure helpers + domain send with stable referenceId.
 * Run: npx tsx lib/domains/send-ghc-flow-tests.ts
 */

import {
  parseGhcAmount,
  buildTransferReference,
} from "./send-ghc-helpers"
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
    appendTransferPair(debit, credit) {
      this.appendTransaction(debit)
      this.appendTransaction(credit)
    },
    listRewards: () => [],
    appendReward: () => {},
    updateReward: () => {},
    getPremium: () => null,
    setPremium: () => {},
  }
}

async function run() {
  console.log("\nGHC Phase D2 Send flow tests\n")

  assert(parseGhcAmount("") === null, "empty amount null")
  assert(parseGhcAmount("0") === null, "zero rejected")
  assert(parseGhcAmount("-5") === null, "negative rejected")
  assert(parseGhcAmount("abc") === null, "non-numeric rejected")
  assert(parseGhcAmount("12.5") === 12.5, "valid decimal")
  assert(parseGhcAmount("1,000") === 1000, "comma stripped")

  const r1 = buildTransferReference("alice", "bob", 10)
  const r2 = buildTransferReference("alice", "bob", 10)
  assert(r1 !== r2, "new build creates distinct refs when called twice")
  assert(r1.includes("bob") && r1.includes("10"), "ref encodes parties/amount")

  // Domain: same referenceId does not double debit
  {
    const repo = memoryRepo()
    const eco = createEconomyDomain({
      currentUserId: "alice",
      repository: repo,
      recipientExists: () => true,
    })
    await eco.recordTransaction({
      kind: "earned",
      amount: 100,
      reason: "seed",
      sourceEvent: "TEST",
      status: "posted",
    })
    const ref = "stable-ref-d2"
    const a = await eco.sendGhcToUser({
      toUserId: "bob",
      toUserName: "Bob",
      amount: 15,
      referenceId: ref,
    })
    const b = await eco.sendGhcToUser({
      toUserId: "bob",
      toUserName: "Bob",
      amount: 15,
      referenceId: ref,
    })
    assert(a.ok && b.ok, "duplicate confirm ok")
    assert(eco.getWallet().balance === 85, "idempotent single debit", `bal=${eco.getWallet().balance}`)
  }

  // Insufficient still fails
  {
    const eco = createEconomyDomain({
      currentUserId: "alice",
      repository: memoryRepo(),
      recipientExists: () => true,
    })
    await eco.recordTransaction({
      kind: "earned",
      amount: 5,
      reason: "seed",
      sourceEvent: "TEST",
      status: "posted",
    })
    const res = await eco.sendGhcToUser({
      toUserId: "bob",
      toUserName: "Bob",
      amount: 50,
      referenceId: "big",
    })
    assert(res.ok === false, "insufficient rejected before success UI")
  }

  // Self transfer
  {
    const eco = createEconomyDomain({
      currentUserId: "alice",
      repository: memoryRepo(),
      recipientExists: () => true,
    })
    await eco.recordTransaction({
      kind: "earned",
      amount: 50,
      reason: "seed",
      sourceEvent: "TEST",
      status: "posted",
    })
    const res = await eco.sendGhcToUser({
      toUserId: "alice",
      toUserName: "Alice",
      amount: 5,
      referenceId: "self",
    })
    assert(res.ok === false, "self-transfer rejected by domain")
  }

  console.log(`\nPhase D2 result: ${passed} passed, ${failed} failed\n`)
  if (failed > 0) process.exitCode = 1
}

run().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
