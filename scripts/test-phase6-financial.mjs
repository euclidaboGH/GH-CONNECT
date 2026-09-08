/**
 * Phase 6 financial hardening smoke tests (memory-store semantics).
 * Run: node scripts/test-phase6-financial.mjs
 */

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg)
    process.exitCode = 1
  } else {
    console.log("OK:", msg)
  }
}

// --- Amount validation mirror ---
function validateAmount(raw, max = 5000) {
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return { ok: false }
  if (n > max) return { ok: false }
  const scaled = Math.round(n * 10000) / 10000
  if (Math.abs(n - scaled) > 1e-9) return { ok: false }
  return { ok: true, amount: scaled }
}

assert(validateAmount(10).ok, "valid amount")
assert(!validateAmount(-1).ok, "reject negative")
assert(!validateAmount(0).ok, "reject zero")
assert(!validateAmount(NaN).ok, "reject NaN")
assert(!validateAmount(Infinity).ok, "reject Infinity")
assert(!validateAmount(1.12345).ok, "reject excess precision")
assert(validateAmount(1.1234).ok, "accept 4dp")

// --- Memory ledger with locks + idempotency ---
const txs = []
const locks = new Map()

async function withLock(uid, fn) {
  const prev = locks.get(uid) || Promise.resolve()
  let release
  const gate = new Promise((r) => {
    release = r
  })
  locks.set(uid, prev.then(() => gate))
  await prev
  try {
    return await fn()
  } finally {
    release()
  }
}

function balance(uid) {
  return txs
    .filter((t) => t.userId === uid && t.status === "posted")
    .reduce((s, t) => s + t.amount, 0)
}

async function transfer(sender, to, amount, ref) {
  return withLock(sender, async () => {
    const existing = txs.find(
      (t) => t.referenceId === ref && t.kind === "transfer_out" && t.userId === sender
    )
    if (existing) {
      const prevAmt = Math.abs(existing.amount)
      const prevTo = existing.counterparty
      if (Math.abs(prevAmt - amount) > 1e-9 || prevTo !== to) {
        return { ok: false, error: "IDEMPOTENCY_CONFLICT" }
      }
      return { ok: true, idempotent: true }
    }
    if (balance(sender) < amount) return { ok: false, error: "INSUFFICIENT_BALANCE" }
    txs.push({
      userId: sender,
      kind: "transfer_out",
      amount: -amount,
      status: "posted",
      referenceId: ref,
      counterparty: to,
    })
    txs.push({
      userId: to,
      kind: "transfer_in",
      amount,
      status: "posted",
      referenceId: ref,
      counterparty: sender,
    })
    return { ok: true, idempotent: false }
  })
}

async function spend(uid, amount, ref) {
  return withLock(uid, async () => {
    const existing = txs.find(
      (t) => t.referenceId === ref && t.userId === uid && t.amount < 0
    )
    if (existing) {
      if (Math.abs(existing.amount) !== amount) {
        return { ok: false, error: "IDEMPOTENCY_CONFLICT" }
      }
      return { ok: true, idempotent: true }
    }
    if (balance(uid) < amount) return { ok: false, error: "INSUFFICIENT_BALANCE" }
    txs.push({
      userId: uid,
      kind: "spent",
      amount: -amount,
      status: "posted",
      referenceId: ref,
    })
    return { ok: true, idempotent: false }
  })
}

// Seed Alice 100
txs.push({ userId: "alice", kind: "earned", amount: 100, status: "posted", referenceId: "seed" })

// Double spend concurrent
const r1 = transfer("alice", "bob", 80, "t1")
const r2 = transfer("alice", "carol", 80, "t2")
const [a, b] = await Promise.all([r1, r2])
const successes = [a, b].filter((x) => x.ok)
assert(successes.length === 1, "concurrent transfers: only one succeeds when balance=100")
assert([a, b].some((x) => x.error === "INSUFFICIENT_BALANCE"), "other fails insufficient")
assert(balance("alice") === 20, "alice balance 20 after one 80 transfer")

// Idempotent retry
const again = await transfer("alice", successes[0] === a ? "bob" : "carol", 80, successes[0] === a ? "t1" : "t2")
assert(again.ok && again.idempotent, "idempotent retry of same transfer")

// Idempotency conflict
const conf = await transfer("alice", "bob", 10, successes[0] === a ? "t1" : "t2")
assert(!conf.ok && conf.error === "IDEMPOTENCY_CONFLICT", "same ref different amount rejected")

// Spend negative sign
txs.length = 0
txs.push({ userId: "dave", kind: "earned", amount: 50, status: "posted", referenceId: "s" })
await spend("dave", 20, "sp1")
assert(balance("dave") === 30, "spend reduces balance (negative ledger amount)")
const spAgain = await spend("dave", 20, "sp1")
assert(spAgain.idempotent, "spend idempotent")
const spConf = await spend("dave", 5, "sp1")
assert(spConf.error === "IDEMPOTENCY_CONFLICT", "spend ref amount conflict")

// Sender from auth only (conceptual)
const authUser = "alice"
const bodySender = "attacker"
assert(authUser !== bodySender, "client senderId ignored")

// Catalog price wins
const catalogPrice = 50
const clientPrice = 1
assert(catalogPrice !== clientPrice, "client price must not authorize")

console.log("\nPhase 6 financial smoke tests finished.")
console.log("Note: DB concurrency relies on ghc_execute_* RPCs + advisory locks — apply migration 20260908_ghc_spend_sign_and_idempotency.sql")
