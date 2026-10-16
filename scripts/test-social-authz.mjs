#!/usr/bin/env node
/**
 * Static social authorization scan — ensures social routes bind actor from session
 * when the route is user-mutating or identity-sensitive.
 *
 * Access policy (Phase 14B):
 * - User-mutating / identity-sensitive routes MUST call resolveAuthenticatedUser.
 * - Public read-only GETs (no private calibration / no actor body) may omit session auth.
 * - System-only routes MUST use an internal key (or equivalent), not a user session.
 *
 * This does NOT replace two-user IDOR tests on Testnet.
 */
import fs from "fs"
import path from "path"

const root = process.cwd()
const socialDir = path.join(root, "app/api/social")
let files = []
function walk(d) {
  for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, ent.name)
    if (ent.isDirectory()) walk(p)
    else if (ent.name === "route.ts") files.push(p)
  }
}
walk(socialDir)

let pass = 0
let fail = 0
const issues = []

/** Relative path using forward slashes */
function relOf(f) {
  return path.relative(root, f).split(path.sep).join("/")
}

/**
 * Routes that are intentionally public read-only (no session).
 * Must remain GET-only and must not accept actor identity from body.
 */
const PUBLIC_READ_ALLOWLIST = new Set([
  "app/api/social/posts/[id]/ghpv/route.ts",
  "app/api/social/posts/[id]/reward/route.ts",
])

/**
 * Routes that are system/operator only (internal key), not end-user session.
 */
const SYSTEM_ONLY_ALLOWLIST = new Set([
  "app/api/social/posts/[id]/ghpv/settle/route.ts",
])

function hasUserSessionAuth(src) {
  return /resolveAuthenticatedUser/.test(src)
}

function hasSystemKeyAuth(src) {
  return (
    /GH_SETTLEMENT_INTERNAL_KEY/.test(src) ||
    /x-gh-settlement-key/.test(src) ||
    /timingSafeEqual/.test(src)
  )
}

function exportsOnlyGet(src) {
  const hasGet = /export\s+async\s+function\s+GET\b/.test(src)
  const hasMut =
    /export\s+async\s+function\s+(POST|PUT|PATCH|DELETE)\b/.test(src)
  return hasGet && !hasMut
}

function trustsBodyIdentity(src) {
  if (/authorId:\s*body\.authorId/.test(src) || /authorId:\s*String\(body\.authorId/.test(src)) {
    return "trusts body.authorId as author"
  }
  if (/p_user_id:\s*body\./.test(src) || /p_actor_id:\s*body\./.test(src)) {
    return "passes body identity into RPC actor"
  }
  return null
}

for (const f of files) {
  const src = fs.readFileSync(f, "utf8")
  const rel = relOf(f)

  // Dangerous patterns always fail (all route classes)
  const bodyIssue = trustsBodyIdentity(src)
  if (bodyIssue) {
    issues.push(`${rel}: ${bodyIssue}`)
    fail++
    continue
  }

  if (SYSTEM_ONLY_ALLOWLIST.has(rel)) {
    if (!hasSystemKeyAuth(src)) {
      issues.push(`${rel}: system route missing internal-key authorization`)
      fail++
      continue
    }
    // Must not pretend to be a user session route without also locking system key
    if (hasUserSessionAuth(src) && !hasSystemKeyAuth(src)) {
      issues.push(`${rel}: system route must not rely on user session alone`)
      fail++
      continue
    }
    pass++
    continue
  }

  if (PUBLIC_READ_ALLOWLIST.has(rel)) {
    if (!exportsOnlyGet(src)) {
      issues.push(`${rel}: public-read allowlist entry must be GET-only`)
      fail++
      continue
    }
    pass++
    continue
  }

  // Default: user social routes require session binding
  if (!hasUserSessionAuth(src)) {
    issues.push(`${rel}: missing resolveAuthenticatedUser`)
    fail++
    continue
  }
  pass++
}

console.log(`Social authz static scan: ${pass} pass, ${fail} fail, ${files.length} routes`)
if (issues.length) {
  for (const i of issues) console.log("  FAIL", i)
  process.exit(1)
}
console.log("ALL SOCIAL AUTHZ STATIC CHECKS PASSED")
