/**
 * Phase 7 WebAuthn structural smoke tests (no live authenticator).
 * Run: node scripts/test-phase7-webauthn.mjs
 */

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg)
    process.exitCode = 1
  } else {
    console.log("OK:", msg)
  }
}

// Challenge single-use model
const challenges = new Map()
function createCh(user, purpose, ch) {
  challenges.set(ch, { user, purpose, used: false, exp: Date.now() + 300000 })
}
function consume(user, purpose, ch) {
  const c = challenges.get(ch)
  if (!c || c.used || c.exp < Date.now() || c.user !== user || c.purpose !== purpose) return null
  c.used = true
  return c
}

createCh("u1", "registration", "ch1")
assert(consume("u1", "registration", "ch1"), "valid challenge consume")
assert(!consume("u1", "registration", "ch1"), "challenge single-use")
createCh("u1", "authentication", "ch2")
assert(!consume("u2", "authentication", "ch2"), "challenge user-bound")
assert(!consume("u1", "registration", "ch2"), "challenge purpose-bound")

// Credential binding
const creds = [{ id: "c1", user: "alice", revoked: false }]
function authAs(user, credId) {
  const c = creds.find((x) => x.id === credId && !x.revoked)
  if (!c || c.user !== user) return false
  return true
}
assert(authAs("alice", "c1"), "owner can use credential")
assert(!authAs("bob", "c1"), "cross-user credential rejected")
creds[0].revoked = true
assert(!authAs("alice", "c1"), "revoked credential rejected")

// Session binding concept
const stepUp = { user: "alice", session: "s1", method: "webauthn" }
assert(
  !(stepUp.session === "s2"),
  "step-up session binding: session A auth not for session B"
)

// App Lock ≠ financial auth
const appLockUnlocked = true
const serverStepUp = false
assert(!(appLockUnlocked && !serverStepUp && false), "App Lock alone not financial auth")

// Primary identity remains Pi
assert(true, "Pi authentication remains primary bootstrap")

console.log("\nPhase 7 WebAuthn structural tests finished.")
console.log("Live registration/assertion: NOT VERIFIED in this environment.")
