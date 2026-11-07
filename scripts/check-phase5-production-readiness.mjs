#!/usr/bin/env node
/**
 * Phase 5 — Global production readiness static gate.
 * Verifies release metadata, wallet withdrawal spine, account lifecycle APIs,
 * media signed-url surface, and migration inventory alignment.
 * Does not claim live Mainnet or funded A2U readiness.
 */
import { readFileSync, existsSync, readdirSync } from "node:fs"
import { join } from "node:path"

const root = process.cwd()
const failures = []
const warnings = []

function ok(msg) {
  console.log(`  OK  ${msg}`)
}
function fail(msg) {
  failures.push(msg)
  console.log(`  FAIL  ${msg}`)
}
function warn(msg) {
  warnings.push(msg)
  console.log(`  WARN  ${msg}`)
}

function read(path) {
  return readFileSync(join(root, path), "utf8")
}

function exists(path) {
  return existsSync(join(root, path))
}

console.log("Phase 5 production readiness gate\n")

// 1. Version consistency
try {
  const pkg = JSON.parse(read("package.json"))
  if (pkg.version !== "0.330.15") fail(`package.json version expected 0.330.15, got ${pkg.version}`)
  else ok(`package.json version ${pkg.version}`)
} catch (e) {
  fail(`package.json unreadable: ${e.message}`)
}

if (exists("VERIFIED_MANIFEST.txt")) {
  const m = read("VERIFIED_MANIFEST.txt")
  if (!m.includes("project_version=0.330.15")) fail("VERIFIED_MANIFEST project_version not 0.330.15")
  else ok("VERIFIED_MANIFEST project_version=0.330.15")
  if (!m.includes("canonical_migrations=189")) warn("VERIFIED_MANIFEST canonical_migrations not 189")
  else ok("canonical_migrations=189")
} else {
  fail("VERIFIED_MANIFEST.txt missing")
}

// 2. Wallet withdrawal spine (Phase 4 carry-forward)
const sheet = "components/ghc/pi-withdraw-sheet.tsx"
if (!exists(sheet)) fail("pi-withdraw-sheet.tsx missing")
else {
  const src = read(sheet)
  if (!src.includes("wasOpenRef")) fail("withdrawal sheet missing open-transition guard (wasOpenRef)")
  else ok("withdrawal sheet open-transition guard")
  if (!src.includes("amountTouchedRef")) fail("withdrawal sheet missing amountTouchedRef")
  else ok("withdrawal sheet amount touch guard")
  if (!src.includes("withdrawal-pin")) fail("withdrawal sheet missing PIN API integration")
  else ok("withdrawal PIN integration present")
  if (!src.includes("requestPiWalletConsent") && !src.includes("fetchWalletAuthorizationStatus")) {
    fail("withdrawal sheet missing Pi consent helpers")
  } else ok("Pi consent helpers referenced")
}

if (!exists("app/api/identity/withdrawal-pin/route.ts")) fail("withdrawal-pin route missing")
else ok("withdrawal-pin API route")

if (!exists("app/api/economy/earnings/withdrawals")) {
  // may be route.ts inside folder
  if (!exists("app/api/economy/earnings/withdrawals/route.ts")) fail("earnings withdrawals route missing")
  else ok("earnings withdrawals route")
} else ok("earnings withdrawals path")

// 3. Account lifecycle (export + deletion request)
for (const p of ["app/api/account/export/route.ts", "app/api/account/lifecycle/route.ts"]) {
  if (!exists(p)) fail(`${p} missing`)
  else {
    const s = read(p)
    if (!s.includes("resolveAuthenticatedUser")) fail(`${p} missing auth`)
    else if (!s.includes("requireRecentStepUp") && !s.includes("step-up")) warn(`${p} may lack step-up`)
    else ok(`${p} present with auth`)
  }
}

// 4. Private media facade
for (const p of ["app/api/media/[id]/signed-url/route.ts", "app/api/media/[id]/content/route.ts"]) {
  if (!exists(p)) fail(`${p} missing`)
  else ok(`${p}`)
}

// 5. Migrations inventory
const migDir = join(root, "supabase/migrations")
if (!existsSync(migDir)) fail("supabase/migrations missing")
else {
  const files = readdirSync(migDir).filter((f) => f.endsWith(".sql"))
  if (files.length < 180) fail(`migration count low: ${files.length}`)
  else ok(`migrations on disk: ${files.length}`)
  if (!files.some((f) => f.includes("withdrawal_pin"))) warn("withdrawal_pin migration filename not found")
  else ok("withdrawal_pin migration present")
}

// 6. Core feature surfaces
const features = [
  "features/wallet",
  "features/messaging",
  "features/marketplace",
  "features/communities",
  "features/feed",
  "features/discovery",
  "features/profile",
  "features/notifications",
]
for (const f of features) {
  if (!exists(f)) fail(`feature missing: ${f}`)
  else ok(`feature ${f}`)
}

// 7. Security headers / vercel
if (exists("vercel.json")) {
  const v = read("vercel.json")
  if (!v.includes("Content-Security-Policy")) warn("vercel.json missing CSP header")
  else ok("vercel CSP present")
  if (!v.includes("Strict-Transport-Security")) warn("vercel.json missing HSTS")
  else ok("vercel HSTS present")
} else warn("vercel.json missing")

// 8. Env example honesty
if (exists(".env.example")) {
  ok(".env.example present")
} else warn(".env.example missing")

// 9. Docs
if (exists("docs/releases/PHASE-5-PRODUCTION-READINESS.md") || exists("docs/GH-CONNECT-PHASE-5-PRODUCTION-READINESS.md")) {
  ok("Phase 5 readiness doc present")
} else {
  // will be created in this package
  warn("Phase 5 readiness doc not yet on disk (expected during package)")
}

console.log("")
if (failures.length) {
  console.log(`RESULT: FAIL (${failures.length} failure(s), ${warnings.length} warning(s))`)
  process.exit(1)
}
console.log(`RESULT: PASS (${warnings.length} warning(s))`)
process.exit(0)

