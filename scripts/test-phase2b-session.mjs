/**
 * Phase 2B session smoke tests (in-process; no Supabase required).
 * Mirrors session-store semantics for validation.
 * Run: node scripts/test-phase2b-session.mjs
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

const IDLE_MS = 7 * 24 * 60 * 60 * 1000
const ABS_MS = 14 * 24 * 60 * 60 * 1000

const byHash = new Map()

function hashToken(raw) {
  return createHash("sha256").update(raw, "utf8").digest("hex")
}

function createSession(ghUserId) {
  const raw = randomBytes(32).toString("base64url")
  const t = Date.now()
  const rec = {
    id: randomBytes(8).toString("hex"),
    tokenHash: hashToken(raw),
    ghUserId,
    createdAt: t,
    lastSeenAt: t,
    expiresAt: t + IDLE_MS,
    absoluteExpiresAt: t + ABS_MS,
    revokedAt: null,
  }
  byHash.set(rec.tokenHash, rec)
  return { raw, rec }
}

function validate(raw) {
  const h = hashToken(raw)
  const rec = byHash.get(h)
  if (!rec) return null
  const now = Date.now()
  if (rec.revokedAt != null) return null
  if (now >= rec.absoluteExpiresAt) return null
  if (now >= rec.expiresAt) return null
  return rec
}

function revoke(raw) {
  const h = hashToken(raw)
  const rec = byHash.get(h)
  if (!rec) return false
  rec.revokedAt = Date.now()
  return true
}

// Cookie attribute builder (mirror)
function cookieHeader(raw, isProd) {
  const parts = [
    `gh_session=${raw}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.floor(ABS_MS / 1000)}`,
  ]
  if (isProd) parts.push("Secure")
  return parts.join("; ")
}

// 1. Valid session
const s1 = createSession("user-a")
assert(validate(s1.raw)?.ghUserId === "user-a", "valid GH session")

// 2. Invalid session
assert(validate("not-a-real-token") === null, "invalid GH session")

// 3. Expired (idle)
const sExp = createSession("user-b")
sExp.rec.expiresAt = Date.now() - 1000
assert(validate(sExp.raw) === null, "expired GH session")

// 4. Revoked
const sRev = createSession("user-c")
revoke(sRev.raw)
assert(validate(sRev.raw) === null, "revoked GH session")

// 5. Logout + replay
const sOut = createSession("user-d")
revoke(sOut.raw)
assert(validate(sOut.raw) === null, "replay of logged-out session fails")

// 6. Cookie security attributes
const cProd = cookieHeader("tok", true)
assert(cProd.includes("HttpOnly"), "cookie HttpOnly")
assert(cProd.includes("SameSite=Lax"), "cookie SameSite=Lax")
assert(cProd.includes("Secure"), "cookie Secure in production")
assert(cProd.includes("Path=/"), "cookie Path=/")
const cDev = cookieHeader("tok", false)
assert(!cDev.includes("Secure"), "cookie Secure omitted in non-prod")

// 7. Token not stored as plaintext identity
assert(s1.rec.tokenHash !== s1.raw, "DB stores hash not raw token")
assert(s1.rec.tokenHash === hashToken(s1.raw), "hash matches")

// 8. Cannot forge from user id alone
assert(validate("user-a") === null, "session cannot be forged from GH user ID")

// 9. Isolation
const sa = createSession("alice")
const sb = createSession("bob")
assert(validate(sa.raw).ghUserId === "alice", "alice session")
assert(validate(sb.raw).ghUserId === "bob", "bob session")
assert(validate(sa.raw).ghUserId !== validate(sb.raw).ghUserId, "sessions isolated")

// 10. Dev auth matrix (from 2A)
function allowDev(env) {
  const isProduction =
    env.NODE_ENV === "production" ||
    env.VERCEL_ENV === "production" ||
    env.GHC_ENV === "production"
  return !isProduction && (env.GHC_ALLOW_DEV_AUTH === "1" || env.NODE_ENV === "test")
}
assert(allowDev({ NODE_ENV: "production", GHC_ALLOW_DEV_AUTH: "1" }) === false, "prod rejects dev token")
assert(allowDev({ NODE_ENV: "development", GHC_ALLOW_DEV_AUTH: "1" }) === true, "dev allows flag")

// 11. Absolute expiry beats idle slide
const sAbs = createSession("user-e")
sAbs.rec.absoluteExpiresAt = Date.now() - 1
sAbs.rec.expiresAt = Date.now() + IDLE_MS
assert(validate(sAbs.raw) === null, "absolute expiry enforced")

console.log("\nPhase 2B session smoke tests finished.")
