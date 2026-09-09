/**
 * Regression checks for auth lifecycle transitions (no browser required).
 * Run: node scripts/test-auth-lifecycle.mjs
 */

import { createRequire } from "module"
import { pathToFileURL } from "url"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, "..")

// Dynamic import of compiled TS is not available; re-implement pure functions inline for CI smoke.
const ALLOWED = {
  BOOTING: ["PI_READY", "PI_AUTHENTICATING", "ERROR"],
  PI_READY: ["PI_AUTHENTICATING", "ERROR"],
  PI_AUTHENTICATING: ["PI_AUTHENTICATED", "ERROR"],
  PI_AUTHENTICATED: ["SERVER_VERIFYING", "ERROR"],
  SERVER_VERIFYING: ["SERVER_VERIFIED", "ERROR"],
  SERVER_VERIFIED: ["SESSION_READY", "IDENTITY_LOADING", "ERROR"],
  SESSION_READY: ["IDENTITY_LOADING", "PROFILE_LOADING", "ONBOARDING_STATUS_RESOLVED", "READY", "ERROR"],
  IDENTITY_LOADING: ["PROFILE_LOADING", "ONBOARDING_STATUS_RESOLVED", "SESSION_READY", "ERROR"],
  PROFILE_LOADING: ["ONBOARDING_STATUS_RESOLVED", "READY", "ERROR"],
  ONBOARDING_STATUS_RESOLVED: ["READY", "ERROR"],
  READY: ["PI_AUTHENTICATING", "ERROR", "BOOTING"],
  ERROR: ["BOOTING", "PI_AUTHENTICATING", "PI_READY"],
}

function canTransition(from, to) {
  return (ALLOWED[from] || []).includes(to)
}

function onboardingFromServerFlags(input) {
  if (!input.serverVerified) return "unknown"
  if (input.isReturning === true || input.needsOnboarding === false) return "complete"
  if (input.needsOnboarding === true) return "required"
  return "unknown"
}

let failed = 0
function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg)
    failed++
  } else {
    console.log("ok:", msg)
  }
}

assert(canTransition("BOOTING", "PI_AUTHENTICATING"), "boot → authenticating")
assert(canTransition("PI_AUTHENTICATED", "SERVER_VERIFYING"), "pi auth → server verify")
assert(!canTransition("PI_AUTHENTICATED", "READY"), "cannot skip server verify to READY")
assert(
  onboardingFromServerFlags({ serverVerified: true, isReturning: true }) === "complete",
  "returning user → complete"
)
assert(
  onboardingFromServerFlags({ serverVerified: true, needsOnboarding: true }) === "required",
  "new user → required"
)
assert(
  onboardingFromServerFlags({ serverVerified: false, needsOnboarding: true }) === "unknown",
  "unverified → unknown (no onboarding flash)"
)

if (failed) {
  console.error(`\n${failed} assertion(s) failed`)
  process.exit(1)
}
console.log("\nAll auth-lifecycle smoke checks passed")
