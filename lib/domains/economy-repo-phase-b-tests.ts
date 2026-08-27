/**
 * Phase B — repository boundary tests for GHC transfers.
 * Run: npx tsx lib/domains/economy-repo-phase-b-tests.ts
 */

import {
  createEconomyDomain,
  createLocalEconomyRepository,
  type EconomyRepository,
} from "./economy-domain"
import { createHttpEconomyRepository } from "./http-repositories"
import type { GhcTransferIntent, GhcTransferResult } from "./economy-transfer-contract"
import { mapTransferFailure, toTransferHttpBody } from "./economy-transfer-contract"
import { DEFAULT_ECONOMY_LIMITS } from "./economy-types"
import { computeWalletFromLedger } from "./economy-ledger"

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

function memoryLocal(): EconomyRepository {
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
    listRewards() {
      return []
    },
    appendReward() {},
    updateReward() {},
    getPremium() {
      return null
    },
    setPremium() {},
  }
}

async function run() {
  console.log("\nGHC Phase B repository tests\n")

  // Contract helpers
  {
    const body = toTransferHttpBody({
      toUserId: "bob",
      amount: 5,
      referenceId: "r1",
      note: "hi",
    })
    assert(!("debit" in body) && !("credit" in body), "HTTP body is intent-only (no debit/credit)")
    assert(body.referenceId === "r1" && body.toUserId === "bob", "intent fields present")
    const err = mapTransferFailure("Insufficient GHC balance")
    assert(err.code === "INSUFFICIENT_BALANCE", "map insufficient balance")
    assert(!err.message.toLowerCase().includes("sql"), "user message has no SQL")
  }

  // Local send still works
  {
    const repo = memoryLocal()
    const eco = createEconomyDomain({
      currentUserId: "alice",
      repository: repo,
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
      toUserId: "bob",
      toUserName: "Bob",
      amount: 8,
      referenceId: "local-1",
    })
    assert(res.ok === true, "local send")
    assert(eco.getWallet().balance === 42, "local debit")
  }

  // Server mode: executeTransfer success — no local fallback path inventing extra debit
  {
    let posts: any[] = []
    const repo: EconomyRepository = {
      mode: "server",
      listTransactions(userId) {
        return (this as any)._txs.filter((t: any) => t.userId === userId)
      },
      appendTransaction(tx) {
        ;(this as any)._txs.push(tx)
      },
      appendTransferPair() {
        throw new Error("appendTransferPair must not run in server success path")
      },
      async executeTransfer(intent: GhcTransferIntent): Promise<GhcTransferResult> {
        posts.push(intent)
        assert(!("debit" in (intent as any)), "intent has no client debit")
        const debit = {
          id: "d1",
          userId: "alice",
          kind: "transfer_out" as const,
          status: "posted" as const,
          amount: -intent.amount,
          reason: "Sent",
          sourceEvent: "WALLET_TRANSFER",
          referenceId: intent.referenceId,
          createdAt: Date.now(),
          postedAt: Date.now(),
        }
        const credit = {
          id: "c1",
          userId: intent.toUserId,
          kind: "transfer_in" as const,
          status: "posted" as const,
          amount: intent.amount,
          reason: "Received",
          sourceEvent: "WALLET_TRANSFER",
          referenceId: intent.referenceId,
          createdAt: Date.now(),
          postedAt: Date.now(),
        }
        return { ok: true, referenceId: intent.referenceId, debitTx: debit, creditTx: credit }
      },
      listRewards: () => [],
      appendReward: () => {},
      updateReward: () => {},
      getPremium: () => null,
      setPremium: () => {},
    }
    ;(repo as any)._txs = [
      {
        id: "seed",
        userId: "alice",
        kind: "earned",
        status: "posted",
        amount: 100,
        reason: "seed",
        sourceEvent: "TEST",
        createdAt: Date.now(),
      },
    ]
    const eco = createEconomyDomain({
      currentUserId: "alice",
      repository: repo,
      recipientExists: () => true,
    })
    const res = await eco.sendGhcToUser({
      toUserId: "bob",
      toUserName: "Bob",
      amount: 15,
      referenceId: "srv-1",
    })
    assert(res.ok === true, "server send contract success")
    assert(posts.length === 1, "single transfer POST intent")
    assert(posts[0].referenceId === "srv-1", "stable reference")
    assert(eco.getWallet().balance === 85, "server debit applied via cache merge")
  }

  // Server failure — no local completion
  {
    const repo: EconomyRepository = {
      mode: "server",
      listTransactions: () => [
        {
          id: "seed",
          userId: "alice",
          kind: "earned",
          status: "posted",
          amount: 100,
          reason: "seed",
          sourceEvent: "TEST",
          createdAt: Date.now(),
        } as any,
      ],
      appendTransaction() {
        throw new Error("must not append on failure")
      },
      async executeTransfer(): Promise<GhcTransferResult> {
        return {
          ok: false,
          error: mapTransferFailure("Insufficient balance"),
        }
      },
      listRewards: () => [],
      appendReward: () => {},
      updateReward: () => {},
      getPremium: () => null,
      setPremium: () => {},
    }
    const eco = createEconomyDomain({
      currentUserId: "alice",
      repository: repo,
      recipientExists: () => true,
    })
    const res = await eco.sendGhcToUser({
      toUserId: "bob",
      toUserName: "Bob",
      amount: 10,
      referenceId: "fail-1",
    })
    assert(res.ok === false, "server failure surfaces")
    assert(eco.getWallet().balance === 100, "no local fallback debit")
  }

  // Network timeout — no new reference / no local success
  {
    const repo: EconomyRepository = {
      mode: "server",
      listTransactions: () => [
        {
          id: "seed",
          userId: "alice",
          kind: "earned",
          status: "posted",
          amount: 40,
          reason: "seed",
          sourceEvent: "TEST",
          createdAt: Date.now(),
        } as any,
      ],
      appendTransaction() {},
      async executeTransfer(): Promise<GhcTransferResult> {
        return {
          ok: false,
          error: mapTransferFailure("timeout waiting for server", "NETWORK_TIMEOUT"),
        }
      },
      async findTransferByReference() {
        return null
      },
      listRewards: () => [],
      appendReward: () => {},
      updateReward: () => {},
      getPremium: () => null,
      setPremium: () => {},
    }
    const eco = createEconomyDomain({
      currentUserId: "alice",
      repository: repo,
      recipientExists: () => true,
    })
    const res = await eco.sendGhcToUser({
      toUserId: "bob",
      toUserName: "Bob",
      amount: 5,
      referenceId: "timeout-1",
    })
    assert(res.ok === false, "timeout does not complete locally")
    assert(eco.getWallet().balance === 40, "balance unchanged after timeout")
  }

  // Duplicate reference on server returns idempotent success
  {
    let calls = 0
    const debit = {
      id: "d-idem",
      userId: "alice",
      kind: "transfer_out" as const,
      status: "posted" as const,
      amount: -3,
      reason: "Sent",
      sourceEvent: "WALLET_TRANSFER",
      referenceId: "idem-s",
      createdAt: 1,
      postedAt: 1,
    }
    const credit = {
      id: "c-idem",
      userId: "bob",
      kind: "transfer_in" as const,
      status: "posted" as const,
      amount: 3,
      reason: "Received",
      sourceEvent: "WALLET_TRANSFER",
      referenceId: "idem-s",
      createdAt: 1,
      postedAt: 1,
    }
    const txs: any[] = [
      {
        id: "seed",
        userId: "alice",
        kind: "earned",
        status: "posted",
        amount: 20,
        reason: "seed",
        sourceEvent: "TEST",
        createdAt: 0,
      },
    ]
    const repo: EconomyRepository = {
      mode: "server",
      listTransactions(userId) {
        return txs.filter((t) => t.userId === userId)
      },
      appendTransaction(tx) {
        if (!txs.some((t) => t.id === tx.id)) txs.push(tx)
      },
      async executeTransfer(intent): Promise<GhcTransferResult> {
        calls++
        return {
          ok: true,
          idempotent: calls > 1,
          referenceId: intent.referenceId,
          debitTx: debit,
          creditTx: credit,
        }
      },
      listRewards: () => [],
      appendReward: () => {},
      updateReward: () => {},
      getPremium: () => null,
      setPremium: () => {},
    }
    const eco = createEconomyDomain({
      currentUserId: "alice",
      repository: repo,
      recipientExists: () => true,
    })
    await eco.sendGhcToUser({
      toUserId: "bob",
      toUserName: "Bob",
      amount: 3,
      referenceId: "idem-s",
    })
    const second = await eco.sendGhcToUser({
      toUserId: "bob",
      toUserName: "Bob",
      amount: 3,
      referenceId: "idem-s",
    })
    assert(second.ok === true, "duplicate reference handled")
    // First path may call execute once; second hits local findPostedByReference
    assert(eco.getWallet().balance === 17, "single debit after idempotent retries", `bal=${eco.getWallet().balance}`)
  }

  // HTTP factory marks server mode
  {
    const fakeFetch: typeof fetch = async () =>
      new Response(JSON.stringify({}), { status: 200 }) as any
    const httpRepo = createHttpEconomyRepository({
      baseUrl: "https://example.test",
      fetchImpl: fakeFetch,
    })
    assert(httpRepo.mode === "server", "HTTP repo is server mode")
    assert(typeof httpRepo.executeTransfer === "function", "executeTransfer present")
  }

  // Local factory still local
  {
    const local = createLocalEconomyRepository()
    assert(local.mode === "local", "local repo mode")
  }

  console.log(`\nPhase B result: ${passed} passed, ${failed} failed\n`)
  if (failed > 0) process.exitCode = 1
}

run().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
