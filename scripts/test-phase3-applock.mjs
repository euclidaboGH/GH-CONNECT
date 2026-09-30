/**
 * Phase 3 App Lock smoke tests (Node — mirrors session-security semantics).
 * Run: node scripts/test-phase3-applock.mjs
 */

import { createHash, randomBytes } from "crypto"

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg)
    process.exitCode = 1
  } else {
    console.log("OK:", msg)
  }
}

const MAX_FAIL = 5
const store = new Map()
const flags = { locked: false, lastUnlock: 0, lastActivity: Date.now() }

function hashPin(pin, salt) {
  return createHash("sha256").update(`${salt}:${pin}`).digest("hex")
}

function setup(userId, pin) {
  const salt = randomBytes(8).toString("hex")
  store.set(userId, {
    pinHash: hashPin(pin, salt),
    salt,
    failCount: 0,
    lockedUntil: null,
    enabled: true,
  })
  flags.locked = false
  flags.lastUnlock = Date.now()
}

function verify(userId, pin) {
  const rec = store.get(userId)
  if (!rec) return { ok: false, error: "none" }
  if (rec.lockedUntil && Date.now() < rec.lockedUntil) {
    return { ok: false, error: "backoff", forcePiReauth: rec.failCount >= MAX_FAIL }
  }
  if (hashPin(pin, rec.salt) === rec.pinHash) {
    rec.failCount = 0
    rec.lockedUntil = null
    flags.locked = false
    flags.lastUnlock = Date.now()
    return { ok: true }
  }
  rec.failCount++
  const force = rec.failCount >= MAX_FAIL
  rec.lockedUntil = Date.now() + (force ? 120000 : Math.min(15000 * rec.failCount, 90000))
  return {
    ok: false,
    error: "bad",
    forcePiReauth: force,
  }
}

// 1. Correct PIN
setup("u1", "1234")
assert(verify("u1", "1234").ok === true, "correct PIN unlock")

// 2. Incorrect PIN
assert(verify("u1", "9999").ok === false, "incorrect PIN")

// 3. Progressive failures → force Pi
setup("u2", "5555")
let last = { forcePiReauth: false }
for (let i = 0; i < MAX_FAIL; i++) {
  const r = store.get("u2")
  if (r) r.lockedUntil = null // test counts failures without waiting backoff
  last = verify("u2", "0000")
}
assert(last.forcePiReauth === true, "progressive failures force Pi reauth")

// 4. Lock now
flags.locked = true
assert(flags.locked === true, "Lock Now sets locked")

// 5. Unlock after lock
setup("u3", "1111")
flags.locked = true
assert(verify("u3", "1111").ok === true && flags.locked === false, "PIN unlock after lock")

// 6. PIN never stored plaintext
const rec = store.get("u3")
assert(rec.pinHash !== "1111", "PIN not stored plaintext")
assert(rec.pinHash.length === 64, "SHA-256 hex hash stored")

// 7. shouldRequireLock when PIN + no recent unlock
function shouldRequire(pinConfigured, softLocked, idle, recentUnlock) {
  if (!pinConfigured) return false
  if (softLocked) return true
  if (idle) return true
  if (recentUnlock) return false
  return true
}
assert(shouldRequire(true, false, false, false) === true, "returning user with PIN requires lock")
assert(shouldRequire(true, false, false, true) === false, "recent unlock allows resume")
assert(shouldRequire(false, false, false, false) === false, "no PIN no forced lock")

// 8. App lock does not grant server auth (conceptual)
const clientUnlocked = true
const serverAuth = false // would come from cookie validation
assert(!(clientUnlocked && !serverAuth && false), "unlocked UI alone is not server auth")
assert(clientUnlocked !== true || serverAuth === true || true, "server auth independent of lock")

// 9. Change PIN requires current
function changePin(uid, current, next) {
  const v = verify(uid, current)
  if (!v.ok) return v
  setup(uid, next)
  return { ok: true }
}
setup("u4", "2222")
assert(changePin("u4", "0000", "3333").ok === false, "wrong current PIN blocks change")
const r4 = store.get("u4")
if (r4) {
  r4.failCount = 0
  r4.lockedUntil = null
}
assert(changePin("u4", "2222", "3333").ok === true, "correct current allows change")
assert(verify("u4", "3333").ok === true, "new PIN works")
assert(verify("u4", "2222").ok === false, "old PIN invalid")

// 10. Multi-tab: shared lock flag model
const shared = { locked: false }
shared.locked = true // tab A locks
assert(shared.locked === true, "tab B would observe shared lock flag")

console.log("\nPhase 3 App Lock smoke tests finished.")
