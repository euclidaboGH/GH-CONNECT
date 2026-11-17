#!/usr/bin/env node
/**
 * Phase 3 — behavioural source contracts for money/auth paths.
 * Static guarantees (no live network). Complements Playwright e2e.
 */
import { readFileSync, existsSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const read = (rel) => readFileSync(join(root, rel), "utf8")

const checks = []
const ok = (name, pass, detail = "") => {
  checks.push({ name, pass: Boolean(pass), detail })
}

// --- payments/approve ---
const approve = read("app/api/payments/approve/route.ts")
ok("approve has durable rate limit", /checkDurableRateLimit/.test(approve))
ok("approve purpose mismatch is hard reject", /PURPOSE_MISMATCH/.test(approve) && /transitionIntent\(intent\.id, "FAILED"/.test(approve))
ok("approve does not leak PI_API_KEY config hint to client", !/Set PI_API_KEY \(Secret\)/.test(approve))
ok("approve does not return raw appr.error to client", !/detail:\s*appr\.error/.test(approve))
ok("approve unbound path blocked in production", /PI_ALLOW_UNBOUND_APPROVE/.test(approve) && /VERCEL_ENV/.test(approve))
ok("approve uses AUTHENTICATION_REQUIRED for owned intents without auth", /AUTHENTICATION_REQUIRED/.test(approve))

// --- JWT / auth ---
const auth = read("lib/server/economy/auth.ts")
ok("JWT requires typ JWT or AT+JWT", /AT\+JWT/.test(auth) && /typ !== "JWT"/.test(auth))
ok("JWT requires configured iss", /GHC_AUTH_JWT_ISSUER/.test(auth) && /!expectedIssuer/.test(auth))
ok("JWT requires configured aud", /GHC_AUTH_JWT_AUDIENCE/.test(auth) && /!expectedAudience/.test(auth))
ok("unsigned JWT sync path is rejected", /unsigned JWT decode is no longer supported/.test(auth))
ok("dev token blocked in production", /REJECTED_DEV_TOKEN_IN_PRODUCTION|isProduction/.test(auth))

// --- operator keys ---
const opKey = read("lib/server/security/operator-key.ts")
ok("operator key rejects multi-env fallback", /envNames\.length !== 1/.test(opKey))
ok("operator key min is 32 bytes", /OPERATOR_KEY_MIN_BYTES = 32/.test(opKey))
ok("public diagnostics removed", !/GHC_PUBLIC_DIAGNOSTICS === "1"/.test(opKey))
ok("diagnostics require reconcile key", /operatorDiagnosticsAuthorized/.test(opKey))

// --- CSRF ---
const csrf = read("lib/csrf-protection.ts")
ok("CSRF uses cookie not localStorage for token store", /gh_csrf/.test(csrf) && !/localStorage\.setItem\(CSRF_TOKEN_KEY/.test(csrf))
ok("CSRF clears legacy localStorage key", /gh-csrf-token/.test(csrf))

// --- session / logout ---
const logout = read("app/api/auth/logout/route.ts")
ok("logout rate limited", /checkDurableRateLimit/.test(logout))
ok("logout clears session cookie", /buildClearSessionCookieHeader/.test(logout))

// --- middleware CSRF contract ---
const mw = read("middleware.ts")
ok("middleware blocks cross-origin mutations", /CROSS_ORIGIN_MUTATION_BLOCKED/.test(mw))
ok("middleware uses crypto.randomUUID for request ids", /crypto\.randomUUID/.test(mw))

// --- secure ids ---
ok("secure-id helper present", existsSync(join(root, "lib/secure-id.ts")))
const secureId = read("lib/secure-id.ts")
ok("secureUUID prefers crypto.randomUUID", /crypto\.randomUUID/.test(secureId))

// --- earnings executor single key ---
const execute = read("app/api/economy/earnings/withdrawals/execute/route.ts")
ok("executor key has no A2U fallback", /PI_EARNINGS_EXECUTOR_KEY/.test(execute) && !/GHC_A2U_ADMIN_KEY\|\|/.test(execute.replace(/\s/g, "")))

let failed = 0
for (const c of checks) {
  console.log(`${c.pass ? "PASS" : "FAIL"} ${c.name}${c.detail ? " — " + c.detail : ""}`)
  if (!c.pass) failed++
}
console.log(`\nPhase 3 money/auth behaviour: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
