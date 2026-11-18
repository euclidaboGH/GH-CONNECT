#!/usr/bin/env node
/** Network-free regression contract for the v0.157.3 cross-phase hardening changes. */
import { readFileSync, existsSync } from "node:fs"
import { readProjectDoc, hasProjectDoc } from './lib/read-project-doc.mjs'
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { dirname } from "node:path"
const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const read = (p) => readFileSync(join(root, p), "utf8")
const pkg = JSON.parse(read("package.json"))
const lock = JSON.parse(read("package-lock.json"))
const middleware = read("middleware.ts")
const profile = read("lib/server/identity/public-profile-hydration.ts")
const restClient = read("lib/server/supabase/rest-client.ts")
const economy = read("lib/server/economy/store.ts")
const pi = read("lib/domains/pi-transaction-normalizer.ts")
const statics = read("scripts/verify-phase14-static.mjs")
const readiness = read("lib/server/readiness.ts")
const identity = read("lib/identity/identity-service.ts")
const economyDomain = read("lib/domains/economy-domain.ts")
const navigation = read("lib/navigation/navigate.ts")
const checks = [
  ["release/package/lock/app versions are synchronized", /^\d+\.\d+\.\d+$/.test(pkg.version) && lock.version === pkg.version && lock.packages?.[""].version === pkg.version && read("lib/app-release.ts").includes(`APP_RELEASE_VERSION = "${pkg.version}"`)],
  ["API middleware assigns and propagates a request correlation ID", /requestCorrelationId\(request\)/.test(middleware) && /requestHeaders\.set\("x-request-id", requestId\)/.test(middleware) && /response\.headers\.set\("X-Request-ID", requestId\)/.test(middleware)],
  ["untrusted request IDs are validated before reuse", /crypto\.randomUUID\(\)/.test(middleware) && /\[0-9a-f\]\{8\}/i.test(middleware)],
  ["cross-origin rejection includes the correlation ID", /CROSS_ORIGIN_MUTATION_BLOCKED", requestId/.test(middleware) && /"X-Request-ID": requestId/.test(middleware)],
  ["canonical identity prioritizes the current Pi UID over cached identity", /input\?\.piUid,\s*input\?\.explicitUserId/.test(identity)],
  ["navigation rejects unsafe externally supplied avatar URLs", /userPhoto: safePhoto\(options\.userPhoto\)/.test(navigation) && /parsed\.protocol === \"https:\"/.test(navigation)],
  ["readiness detects malformed explicit Pi network flags", /pi_sandbox_flag_schema/.test(readiness) && /invalidSandboxFlag/.test(readiness)],
  ["profile hydration keeps its upstream deadline", /timeoutMs:\s*5000/.test(profile) && /signal:\s*fetchInit\.signal \?\? AbortSignal\.timeout\(timeoutMs \?\? 15_000\)/.test(restClient)],
  ["profile hydration enforces a streaming 1 MiB response limit", /maxResponseBytes:\s*1024 \* 1024/.test(profile) && /total > maxResponseBytes/.test(restClient) && /SUPABASE_REST_RESPONSE_TOO_LARGE/.test(restClient)],
  ["profile hydration limits response rows and identity scope", /data\.length > ids\.length/.test(profile) && /requestedIds\.has\(id\)/.test(profile)],
  ["profile projection selects public fields only", /select: "gh_user_id,display_name,username,photos"/.test(profile) && !/select: "[^"]*(balance|membership|entitlement|wallet)/i.test(profile)],
  ["authoritative GHC store entry points reject negative inputs without Math.abs coercion", !/Math\.abs\(Number\(input\.amount\)\)/.test(economy) && (economy.match(/const amount = Number\(input\.amount\)/g) || []).length >= 6],
  ["GHC domain spend, send, request, and request-fulfilment preserve negative-input rejection", /const abs = Number\(input\.amount\)/.test(economyDomain) && (economyDomain.match(/const amount = Number\(input\.amount\)/g) || []).length >= 2 && /rawAmount = input\.amount \?\? reqTx\?\.amount/.test(economyDomain) && !/Math\.abs\(Number\(input\.amount/.test(economyDomain)],
  ["Pi history rejects blank supplied amounts", /rawAmount === null \|\| rawAmount === undefined/.test(pi) && /amountPi/.test(pi) && /parsed <= 0/.test(pi)],
  ["Pi history bounds amount magnitude and decimal precision", /parsed >= 10_000_000_000/.test(pi) && /Number\(parsed\.toFixed\(8\)\) !== parsed/.test(pi)],
  ["Phase 3 identity regression check is registered", statics.includes("check-phase3-profile-identity.mjs")],
  ["Phase 9 transaction regression check is registered", statics.includes("check-phase9-wallet-transaction-integration.mjs")],
  ["release acceptance boundaries remain documented", /runtime|operational|operator/i.test(readProjectDoc("docs/PHASE-1-12-SYSTEM-WIDE-ACCEPTANCE.md"))],
  ["new hardening worklog exists", hasProjectDoc("docs/UPGRADE-WORKLOG-0.157.12.md")],
]
let failed = 0
for (const [label, ok] of checks) { console.log(`${ok ? "PASS" : "FAIL"} ${label}`); if (!ok) failed++ }
console.log(`\nPhase 1–12 hardening audit: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
