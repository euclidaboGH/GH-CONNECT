/**
 * Phase 2A smoke tests (no network / no DB required for memory path).
 * Run: node scripts/test-phase2a-identity.mjs
 */

import { createRequire } from "module"
import { pathToFileURL } from "url"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, "..")

// We test pure logic via dynamic import of compiled-like TS isn't available;
// instead validate env allowDevAuth matrix and in-process store via a minimal reimplementation check.

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg)
    process.exitCode = 1
  } else {
    console.log("OK:", msg)
  }
}

// --- PART A: production dev-auth matrix (mirror env.ts rules) ---
function computeAllowDevAuth(env) {
  const isProduction =
    env.NODE_ENV === "production" ||
    env.VERCEL_ENV === "production" ||
    env.GHC_ENV === "production"
  return (
    !isProduction &&
    (env.GHC_ALLOW_DEV_AUTH === "1" || env.NODE_ENV === "test")
  )
}

assert(
  computeAllowDevAuth({ NODE_ENV: "production", GHC_ALLOW_DEV_AUTH: "1" }) === false,
  "production + GHC_ALLOW_DEV_AUTH=1 → deny"
)
assert(
  computeAllowDevAuth({ NODE_ENV: "production", VERCEL_ENV: "production" }) === false,
  "production Vercel → deny"
)
assert(
  computeAllowDevAuth({ NODE_ENV: "development", GHC_ALLOW_DEV_AUTH: "1" }) === true,
  "development + flag → allow"
)
assert(
  computeAllowDevAuth({ NODE_ENV: "development" }) === false,
  "development without flag → deny"
)
assert(
  computeAllowDevAuth({ NODE_ENV: "test" }) === true,
  "NODE_ENV=test → allow"
)
assert(
  computeAllowDevAuth({ NODE_ENV: "development", VERCEL_ENV: "production", GHC_ALLOW_DEV_AUTH: "1" }) === false,
  "VERCEL_ENV=production overrides → deny"
)

// --- PART B: memory identity semantics ---
const byPi = new Map()
const byGh = new Map()

function findOrCreate(piAppUid, piUsername) {
  const existing = byPi.get(piAppUid)
  if (existing) {
    const updated = { ...existing, piUsername: piUsername ?? existing.piUsername, onboardingCompleted: existing.onboardingCompleted }
    byPi.set(piAppUid, updated)
    byGh.set(updated.ghUserId, updated)
    return { record: updated, isNew: false }
  }
  const rec = {
    piAppUid,
    ghUserId: piAppUid,
    piUsername: piUsername || null,
    onboardingCompleted: false,
  }
  byPi.set(piAppUid, rec)
  byGh.set(rec.ghUserId, rec)
  return { record: rec, isNew: true }
}

function markOnboarded(ghUserId) {
  const rec = byGh.get(ghUserId)
  if (!rec) return null
  const updated = { ...rec, onboardingCompleted: true }
  byPi.set(updated.piAppUid, updated)
  byGh.set(updated.ghUserId, updated)
  return updated
}

// 1. New identity
let r1 = findOrCreate("uid-new-1", "alice")
assert(r1.isNew === true, "new Pi identity isNew")
assert(r1.record.onboardingCompleted === false, "new identity needs onboarding")

// 2. Existing identity
let r2 = findOrCreate("uid-new-1", "alice")
assert(r2.isNew === false, "existing Pi identity not new")
assert(r2.record.onboardingCompleted === false, "still not onboarded")

// 3. Onboarding completion + idempotent
let m1 = markOnboarded("uid-new-1")
assert(m1 && m1.onboardingCompleted === true, "onboarding complete")
let m2 = markOnboarded("uid-new-1")
assert(m2 && m2.onboardingCompleted === true, "idempotent onboarding complete")

// 4. Returning after "restart" (memory still has data — simulates durable when DB present)
let r3 = findOrCreate("uid-new-1", "alice")
assert(r3.isNew === false && r3.record.onboardingCompleted === true, "returning user onboarded")

// 5. Simulate cold restart without durable (memory clear)
byPi.clear()
byGh.clear()
let r4 = findOrCreate("uid-new-1", "alice")
assert(r4.isNew === true && r4.record.onboardingCompleted === false, "memory-only loses mapping on restart (why durable DB is required)")

// 6. Identity uniqueness
findOrCreate("uid-a", "a")
findOrCreate("uid-b", "b")
assert(byPi.has("uid-a") && byPi.has("uid-b"), "two distinct pi uids")

console.log("\nPhase 2A identity smoke tests finished.")
console.log("Note: durable returning-user after real server restart requires applying migration 20260908_gh_pi_identities.sql")
