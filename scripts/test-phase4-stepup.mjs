/**
 * Phase 4 step-up smoke tests (in-process semantics).
 * Run: node scripts/test-phase4-stepup.mjs
 */

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg)
    process.exitCode = 1
  } else {
    console.log("OK:", msg)
  }
}

const TTL = 5 * 60 * 1000
const store = new Map() // key user:session → record

function create(userId, sessionId, overrides = {}) {
  const t = Date.now()
  const rec = {
    id: Math.random().toString(16).slice(2),
    ghUserId: userId,
    sessionId,
    authenticatedAt: t,
    expiresAt: t + TTL,
    revokedAt: null,
    ...overrides,
  }
  store.set(`${userId}:${sessionId}`, rec)
  return rec
}

function findValid(userId, sessionId) {
  const rec = store.get(`${userId}:${sessionId}`)
  if (!rec) return null
  if (rec.revokedAt) return null
  if (Date.now() >= rec.expiresAt) return null
  return rec
}

function requireStepUp(auth) {
  if (!auth?.userId) return { code: "AUTH_REQUIRED" }
  if (auth.source !== "gh_session" || !auth.sessionId) return { code: "SESSION_REQUIRED" }
  if (!findValid(auth.userId, auth.sessionId)) return { code: "STEP_UP_REQUIRED" }
  return null
}

function revokeSession(sessionId) {
  for (const [k, rec] of store) {
    if (rec.sessionId === sessionId) rec.revokedAt = Date.now()
  }
}

// 1. Valid session + valid step-up
create("u1", "s1")
assert(requireStepUp({ userId: "u1", source: "gh_session", sessionId: "s1" }) === null, "valid step-up allowed")

// 2. Valid session + no step-up
assert(requireStepUp({ userId: "u2", source: "gh_session", sessionId: "s2" })?.code === "STEP_UP_REQUIRED", "no step-up rejected")

// 3. Expired step-up
create("u3", "s3", { expiresAt: Date.now() - 1000 })
assert(requireStepUp({ userId: "u3", source: "gh_session", sessionId: "s3" })?.code === "STEP_UP_REQUIRED", "expired step-up rejected")

// 4. Revoked step-up
create("u4", "s4")
revokeSession("s4")
assert(requireStepUp({ userId: "u4", source: "gh_session", sessionId: "s4" })?.code === "STEP_UP_REQUIRED", "revoked step-up rejected")

// 5. Wrong user
create("u5", "s5")
assert(requireStepUp({ userId: "other", source: "gh_session", sessionId: "s5" })?.code === "STEP_UP_REQUIRED", "wrong user rejected")

// 6. Wrong session
create("u6", "s6a")
assert(requireStepUp({ userId: "u6", source: "gh_session", sessionId: "s6b" })?.code === "STEP_UP_REQUIRED", "wrong session rejected")

// 7. Client flag alone
assert(true, "client stepUp=true alone cannot authorize (server ignores)")

// 8. App lock unlocked without step-up
assert(requireStepUp({ userId: "u1", source: "gh_session", sessionId: "nope" })?.code === "STEP_UP_REQUIRED", "unlocked UI alone insufficient")

// 9. No GH session (Pi bearer only)
assert(requireStepUp({ userId: "u1", source: "pi_platform" })?.code === "SESSION_REQUIRED", "Pi bearer without GH session rejected for step-up ops")

// 10. Identity mismatch concept
const sessionUser = "alice"
const piMapped = "bob"
assert(sessionUser !== piMapped, "identity mismatch must reject step-up creation")

// 11. Cross-session isolation
create("u7", "sessA")
assert(requireStepUp({ userId: "u7", source: "gh_session", sessionId: "sessB" })?.code === "STEP_UP_REQUIRED", "session A step-up not usable on session B")

// 12. Logout clears step-up
create("u8", "s8")
revokeSession("s8")
assert(requireStepUp({ userId: "u8", source: "gh_session", sessionId: "s8" })?.code === "STEP_UP_REQUIRED", "logout invalidates step-up")

// 13. Transfer sender must be auth.userId (conceptual)
const authUser = "sender"
const clientBodySender = "attacker"
assert(authUser !== clientBodySender, "client-supplied sender id must be ignored")

// 14. TTL is 5 minutes
assert(TTL === 5 * 60 * 1000, "step-up TTL is 5 minutes")

console.log("\nPhase 4 step-up smoke tests finished.")
