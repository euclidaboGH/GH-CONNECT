/**
 * Static gate: identity conflict + client trust boundaries (Section B).
 * Does not hit live Supabase — source inspection only.
 */
import { readFileSync, existsSync } from "fs"
import { join } from "path"

const root = process.cwd()
const fails = []

function read(rel) {
  const p = join(root, rel)
  if (!existsSync(p)) {
    fails.push(`missing file: ${rel}`)
    return ""
  }
  return readFileSync(p, "utf8")
}

const store = read("lib/server/identity/pi-identity-store.ts")
const authPi = read("app/api/auth/pi/route.ts")
const economyAuth = read("lib/server/economy/auth.ts")
const identitySvc = read("lib/identity/identity-service.ts")
const readiness = read("lib/server/readiness.ts")

// 1) Conflict type / handling
if (!store.includes("IDENTITY_CONFLICT")) {
  fails.push("pi-identity-store must define/handle IDENTITY_CONFLICT")
}
if (!store.includes("findOrCreateFromVerifiedPi")) {
  fails.push("findOrCreateFromVerifiedPi required")
}
if (!store.includes("isPiIdentityDurable")) {
  fails.push("isPiIdentityDurable required")
}
if (!store.includes("randomUUID") && !store.includes("newGhUserId")) {
  fails.push("internal ghUserId allocation expected")
}

// 2) Auth/pi never trusts client uid
if (!authPi.includes("Never trust client-supplied") && !authPi.includes("Never trust client")) {
  fails.push("auth/pi route must document no client-supplied uid/ghUserId")
}
if (authPi.includes("body.ghUserId") || authPi.includes("body.userId")) {
  // Using body as identity source is forbidden
  if (/ghUserId\s*=\s*.*body|userId\s*=\s*.*body/.test(authPi)) {
    fails.push("auth/pi must not assign identity from request body")
  }
}
if (!authPi.includes("findOrCreateFromVerifiedPi")) {
  fails.push("auth/pi must call findOrCreateFromVerifiedPi")
}
if (!authPi.includes("IDENTITY_STORE_UNAVAILABLE") && !authPi.includes("isPiIdentityDurable")) {
  fails.push("auth/pi should fail closed when durable identity unavailable in production")
}

// 3) Economy auth prefers session / Pi verification
if (!economyAuth.includes("validateSession") && !economyAuth.includes("gh_session")) {
  fails.push("economy auth must support GH server session")
}
if (!economyAuth.includes("verifyPiAccessToken") && !economyAuth.includes("pi_platform")) {
  fails.push("economy auth must support Pi platform verification path")
}

// 4) Client IdentityService is presentation only
if (!identitySvc.includes("SessionIdentity") && !identitySvc.includes("userId")) {
  fails.push("IdentityService session shape missing")
}
if (/setUserId\s*\(\s*body/.test(identitySvc)) {
  fails.push("IdentityService must not set userId from arbitrary body")
}

// 5) Readiness reports durable identity
if (!readiness.includes("identity_durable") || !readiness.includes("session_durable")) {
  fails.push("readiness must expose identity_durable and session_durable checks")
}

if (fails.length) {
  console.error("test-identity-conflict-static FAILED:")
  fails.forEach((f) => console.error(" -", f))
  process.exit(1)
}
console.log("test-identity-conflict-static: PASS")
