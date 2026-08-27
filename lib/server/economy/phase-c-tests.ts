/**
 * Phase C — authoritative GHC server store tests (in-memory mirror of SQL rules).
 * Run: npx tsx lib/server/economy/phase-c-tests.ts
 */

import {
  createMemoryGhcStore,
  executeAuthoritativeTransfer,
  createTransferRequest,
  acceptTransferRequest,
  declineTransferRequest,
  cancelTransferRequest,
} from "./store"
import { mapTransferFailure } from "../../domains/economy-transfer-contract"

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
  console.log("\nGHC Phase C authoritative store tests\n")

  // successful transfer
  {
    const store = createMemoryGhcStore()
    store.appendPosted({
      id: "s1",
      userId: "alice",
      kind: "earned",
      amount: 100,
      status: "posted",
      reason: "seed",
      sourceEvent: "TEST",
      createdAt: Date.now(),
    })
    const r = await executeAuthoritativeTransfer(store, {
      senderId: "alice",
      toUserId: "bob",
      amount: 25,
      referenceId: "ref-ok",
    })
    assert(r.ok === true, "successful transfer")
    if (r.ok) {
      assert(r.debitTx.kind === "transfer_out" && r.debitTx.amount === -25, "sender transfer_out")
      assert(r.creditTx.kind === "transfer_in" && r.creditTx.amount === 25, "recipient transfer_in")
      assert(r.debitTx.referenceId === r.creditTx.referenceId, "same referenceId")
      assert(store.availableBalance("alice") === 75, "sender balance")
      assert(store.availableBalance("bob") === 25, "recipient balance")
    }
  }

  // insufficient
  {
    const store = createMemoryGhcStore()
    store.appendPosted({
      id: "s",
      userId: "alice",
      kind: "earned",
      amount: 5,
      status: "posted",
      reason: "seed",
      sourceEvent: "TEST",
      createdAt: 1,
    })
    const r = await executeAuthoritativeTransfer(store, {
      senderId: "alice",
      toUserId: "bob",
      amount: 10,
      referenceId: "insuf",
    })
    assert(r.ok === false && r.error.code === "INSUFFICIENT_BALANCE", "insufficient balance")
  }

  // self / blocked / restricted / invalid amount
  {
    const store = createMemoryGhcStore()
    store.appendPosted({
      id: "s",
      userId: "alice",
      kind: "earned",
      amount: 50,
      status: "posted",
      reason: "seed",
      sourceEvent: "TEST",
      createdAt: 1,
    })
    assert(
      (await executeAuthoritativeTransfer(store, {
        senderId: "alice",
        toUserId: "alice",
        amount: 1,
        referenceId: "self",
      })).ok === false,
      "self-transfer rejected"
    )
    store.setBlock("alice", "bob")
    assert(
      (await executeAuthoritativeTransfer(store, {
        senderId: "alice",
        toUserId: "bob",
        amount: 1,
        referenceId: "blk",
      })).ok === false,
      "blocked transfer rejected"
    )
    store.setRestricted("carol", true)
    store.appendPosted({
      id: "c",
      userId: "carol",
      kind: "earned",
      amount: 50,
      status: "posted",
      reason: "seed",
      sourceEvent: "TEST",
      createdAt: 1,
    })
    assert(
      (await executeAuthoritativeTransfer(store, {
        senderId: "carol",
        toUserId: "dave",
        amount: 1,
        referenceId: "rst",
      })).ok === false,
      "restricted account rejected"
    )
    assert(
      (await executeAuthoritativeTransfer(store, {
        senderId: "alice",
        toUserId: "eve",
        amount: 0,
        referenceId: "z",
      })).ok === false,
      "invalid amount rejected"
    )
  }

  // concurrent: only one of two 80-from-100 succeeds
  {
    const store = createMemoryGhcStore()
    store.appendPosted({
      id: "s",
      userId: "alice",
      kind: "earned",
      amount: 100,
      status: "posted",
      reason: "seed",
      sourceEvent: "TEST",
      createdAt: 1,
    })
    const [a, b] = await Promise.all([
      executeAuthoritativeTransfer(store, {
        senderId: "alice",
        toUserId: "bob",
        amount: 80,
        referenceId: "c1",
      }),
      executeAuthoritativeTransfer(store, {
        senderId: "alice",
        toUserId: "bob",
        amount: 80,
        referenceId: "c2",
      }),
    ])
    const wins = [a, b].filter((x) => x.ok).length
    assert(wins === 1, "concurrent transfers: only one succeeds", `wins=${wins}`)
    assert(store.availableBalance("alice") === 20, "balance after concurrent")
  }

  // idempotent reference
  {
    const store = createMemoryGhcStore()
    store.appendPosted({
      id: "s",
      userId: "alice",
      kind: "earned",
      amount: 50,
      status: "posted",
      reason: "seed",
      sourceEvent: "TEST",
      createdAt: 1,
    })
    const first = await executeAuthoritativeTransfer(store, {
      senderId: "alice",
      toUserId: "bob",
      amount: 10,
      referenceId: "idem",
    })
    const second = await executeAuthoritativeTransfer(store, {
      senderId: "alice",
      toUserId: "bob",
      amount: 10,
      referenceId: "idem",
    })
    assert(first.ok && second.ok && second.ok && second.idempotent === true, "duplicate reference idempotent")
    assert(store.availableBalance("alice") === 40, "single debit on retry")
  }

  // request lifecycle
  {
    const store = createMemoryGhcStore()
    store.appendPosted({
      id: "s",
      userId: "bob",
      kind: "earned",
      amount: 100,
      status: "posted",
      reason: "seed",
      sourceEvent: "TEST",
      createdAt: 1,
    })
    const created = await createTransferRequest(store, {
      requesterId: "alice",
      payerId: "bob",
      amount: 12,
      referenceId: "req-1",
    })
    assert(created.ok === true, "request creation")
    assert(store.availableBalance("alice") === 0 && store.availableBalance("bob") === 100, "request does not move balance")

    const paid = await acceptTransferRequest(store, { actorId: "bob", referenceId: "req-1" })
    assert(paid.ok === true, "request acceptance")
    assert(store.availableBalance("bob") === 88 && store.availableBalance("alice") === 12, "pay moves GHC")

    const paid2 = await acceptTransferRequest(store, { actorId: "bob", referenceId: "req-1" })
    assert(paid2.ok === true && (paid2 as any).idempotent === true, "duplicate payment blocked/idempotent")
    assert(store.availableBalance("bob") === 88, "no double pay")
  }

  // decline / cancel / unauthorized
  {
    const store = createMemoryGhcStore()
    await createTransferRequest(store, {
      requesterId: "alice",
      payerId: "bob",
      amount: 5,
      referenceId: "req-d",
    })
    const bad = await declineTransferRequest(store, { actorId: "alice", referenceId: "req-d" })
    assert(bad.ok === false, "requester cannot decline")
    const okd = await declineTransferRequest(store, { actorId: "bob", referenceId: "req-d" })
    assert(okd.ok === true, "payer can decline")

    await createTransferRequest(store, {
      requesterId: "alice",
      payerId: "bob",
      amount: 5,
      referenceId: "req-c",
    })
    const badc = await cancelTransferRequest(store, { actorId: "bob", referenceId: "req-c" })
    assert(badc.ok === false, "payer cannot cancel")
    const okc = await cancelTransferRequest(store, { actorId: "alice", referenceId: "req-c" })
    assert(okc.ok === true, "requester can cancel")
  }

  // expired request cannot pay
  {
    const store = createMemoryGhcStore()
    store.appendPosted({
      id: "s",
      userId: "bob",
      kind: "earned",
      amount: 50,
      status: "posted",
      reason: "seed",
      sourceEvent: "TEST",
      createdAt: 1,
    })
    await createTransferRequest(store, {
      requesterId: "alice",
      payerId: "bob",
      amount: 5,
      referenceId: "req-exp",
      limits: {
        maxDailyEarn: 500,
        maxPendingRewards: 50,
        minBalance: 0,
        minimumTransferAmount: 1,
        maximumTransferAmount: 5000,
        dailySendLimit: 2000,
        dailyReceiveLimit: 5000,
        dailyRequestLimit: 20,
        maximumOpenRequests: 10,
        requestExpiryMs: 1,
      },
    })
    await new Promise((r) => setTimeout(r, 5))
    const paid = await acceptTransferRequest(store, { actorId: "bob", referenceId: "req-exp" })
    assert(paid.ok === false, "expired request cannot be paid")
  }

  // pending reward not spendable
  {
    const store = createMemoryGhcStore()
    store.appendPosted({
      id: "p",
      userId: "alice",
      kind: "pending",
      amount: 40,
      status: "pending",
      reason: "hold",
      sourceEvent: "REWARD",
      createdAt: 1,
    })
    const r = await executeAuthoritativeTransfer(store, {
      senderId: "alice",
      toUserId: "bob",
      amount: 10,
      referenceId: "pend",
    })
    assert(r.ok === false, "pending rewards not transferable")
  }

  // events on send not duplicated on idempotent retry
  {
    const store = createMemoryGhcStore()
    store.appendPosted({
      id: "s",
      userId: "alice",
      kind: "earned",
      amount: 30,
      status: "posted",
      reason: "seed",
      sourceEvent: "TEST",
      createdAt: 1,
    })
    await executeAuthoritativeTransfer(store, {
      senderId: "alice",
      toUserId: "bob",
      amount: 5,
      referenceId: "evt",
    })
    await executeAuthoritativeTransfer(store, {
      senderId: "alice",
      toUserId: "bob",
      amount: 5,
      referenceId: "evt",
    })
    const sent = store.listEvents("alice").filter((e) => e.type === "GHC_SENT")
    assert(sent.length === 1, "no duplicate GHC_SENT on idempotent retry", `n=${sent.length}`)
  }

  // client cannot invent sender via store API — execute always uses senderId param from auth layer
  {
    const err = mapTransferFailure("sql error: relation does not exist")
    assert(err.message.toLowerCase().indexOf("sql") < 0, "errors hide SQL")
  }

  console.log(`\nPhase C result: ${passed} passed, ${failed} failed\n`)
  if (failed > 0) process.exitCode = 1
}

run().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
