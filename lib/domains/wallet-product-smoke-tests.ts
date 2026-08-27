/**
 * Wallet product smoke: claim → available → boost spend (in-memory ledger).
 */
import { createEconomyDomain, type EconomyRepository } from "./economy-domain"
import { createLedgerTransaction } from "./economy-ledger"
import type { GhcTransaction, RewardRecord, PremiumMembership } from "./economy-types"

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg)
}

function createMemoryRepo(): EconomyRepository {
  const txs: GhcTransaction[] = []
  const rewards: RewardRecord[] = []
  let premium: PremiumMembership | null = null
  return {
    mode: "local",
    listTransactions: (userId) => txs.filter((t) => t.userId === userId),
    appendTransaction: (tx) => {
      txs.push(tx)
    },
    appendTransferPair: (debit, credit) => {
      txs.push(debit, credit)
    },
    updateTransaction: (userId, id, patch) => {
      const i = txs.findIndex((t) => t.id === id && t.userId === userId)
      if (i >= 0) txs[i] = { ...txs[i], ...patch }
    },
    listRewards: (userId) => rewards.filter((r) => r.userId === userId),
    appendReward: (r) => {
      rewards.push(r)
    },
    updateReward: (id, patch) => {
      const i = rewards.findIndex((r) => r.id === id)
      if (i >= 0) rewards[i] = { ...rewards[i], ...patch }
    },
    getPremium: () => premium,
    setPremium: (m) => {
      premium = m
    },
  }
}

async function main() {
  const repo = createMemoryRepo()
  const eco = createEconomyDomain({ currentUserId: "smoke-user", repository: repo }) as any

  const pending = createLedgerTransaction({
    userId: "smoke-user",
    kind: "pending",
    amount: 40,
    reason: "Verified platform achievement",
    sourceEvent: "ACHIEVEMENT_UNLOCKED",
    referenceId: "ach_smoke_1",
    status: "pending",
  })
  assert(pending.ok, "pending build")
  repo.appendTransaction(pending.tx!)

  let w = eco.getWallet()
  assert(w.balance === 0, "start balance 0")
  assert(w.pending >= 40, `pending >= 40 got ${w.pending}`)

  const claim = await eco.claimReward("ach_smoke_1")
  assert(claim.ok, "claim ok: " + claim.error)
  w = eco.getWallet()
  assert(w.balance >= 40, `balance after claim ${w.balance}`)
  assert(w.pending < 40, `pending reduced ${w.pending}`)

  const boostFail = await eco.purchaseBoost({ target: "profile", amount: 5000 })
  assert(!boostFail.ok, "boost fails if insufficient")

  const boost = await eco.purchaseBoost({ target: "profile", amount: 25 })
  assert(boost.ok, "boost ok: " + boost.error)
  w = eco.getWallet()
  assert(w.balance === 15, `balance after boost ${w.balance}`)

  console.log("wallet-product-smoke: PASS")
}

main().catch((e) => {
  console.error("wallet-product-smoke: FAIL", e)
  process.exit(1)
})
