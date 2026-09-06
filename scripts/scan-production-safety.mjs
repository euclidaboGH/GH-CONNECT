/**
 * Step 5 — static production safety scan (no network, no secrets printed).
 */
import { readFileSync, readdirSync, statSync, existsSync } from "fs"
import { join, relative, dirname } from "path"
import { fileURLToPath } from "url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
let passed = 0
let failed = 0
const assert = (c, m) => {
  if (c) {
    passed++
    console.log("  ✓", m)
  } else {
    failed++
    console.error("  ✗", m)
  }
}

const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "dist", "coverage", ".turbo", "scripts"])

function walk(dir, out = []) {
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue
    const p = join(dir, name)
    let st
    try {
      st = statSync(p)
    } catch {
      continue
    }
    if (st.isDirectory()) walk(p, out)
    else if (/\.(ts|tsx|js|jsx)$/.test(name)) out.push(p)
  }
  return out
}

/** True only for real assignments / env reads, not documentation strings */
function hasPublicPrivilegedKey(text) {
  // Match NEXT_PUBLIC_PI_API_KEY or NEXT_PUBLIC_SUPABASE_SERVICE_ROLE as identifiers in code
  const re =
    /(?:process\.env\.|["'`])NEXT_PUBLIC_(?:PI_API_KEY|SUPABASE_SERVICE_ROLE(?:_KEY)?|SERVICE_ROLE_KEY)/g
  let m
  while ((m = re.exec(text))) {
    const start = Math.max(0, m.index - 40)
    const ctx = text.slice(start, m.index + m[0].length + 10)
    // Ignore negative assertions: !x.includes("NEXT_PUBLIC_PI_API_KEY")
    if (/includes\s*\(\s*["']NEXT_PUBLIC_/.test(ctx)) continue
    if (/assert\s*\(\s*!/.test(ctx)) continue
    return true
  }
  return false
}

console.log("\n=== STEP 5 PRODUCTION SAFETY SCAN ===\n")

const files = walk(root)
assert(files.length > 50, `scanned ${files.length} source files`)

const publicSecretHits = []
const clientPiKeyHits = []
const serviceRoleClientHits = []
const useClientMisplaced = []

for (const file of files) {
  const rel = relative(root, file)
  let text
  try {
    text = readFileSync(file, "utf8")
  } catch {
    continue
  }

  if (hasPublicPrivilegedKey(text)) {
    publicSecretHits.push(rel)
  }

  const isClient = text.includes('"use client"') || text.includes("'use client'")

  if (isClient && /process\.env\.PI_API_KEY/.test(text)) {
    clientPiKeyHits.push(rel)
  }

  if (isClient && /process\.env\.SUPABASE_SERVICE_ROLE_KEY/.test(text)) {
    serviceRoleClientHits.push(rel)
  }

  if (isClient) {
    const lines = text.split(/\r?\n/)
    let firstMeaningful = -1
    for (let i = 0; i < Math.min(lines.length, 20); i++) {
      const s = lines[i].trim()
      if (!s) continue
      if (s.startsWith("//") || s.startsWith("/*") || s.startsWith("*") || s.startsWith("*/")) continue
      firstMeaningful = i
      break
    }
    if (firstMeaningful >= 0) {
      const s = lines[firstMeaningful].trim().replace(/;$/, "")
      if (s !== '"use client"' && s !== "'use client'") {
        const dirLine = lines.findIndex((l) => /["']use client["']/.test(l))
        if (dirLine > firstMeaningful) useClientMisplaced.push(`${rel}:${firstMeaningful + 1}`)
      }
    }
  }
}

assert(
  publicSecretHits.length === 0,
  publicSecretHits.length
    ? `no NEXT_PUBLIC privileged keys (${publicSecretHits.slice(0, 3).join(", ")})`
    : "no NEXT_PUBLIC privileged key names"
)
assert(
  clientPiKeyHits.length === 0,
  clientPiKeyHits.length
    ? `no PI_API_KEY on client (${clientPiKeyHits.slice(0, 3).join(", ")})`
    : "no PI_API_KEY on client modules"
)
assert(serviceRoleClientHits.length === 0, "no SUPABASE_SERVICE_ROLE_KEY on client modules")
assert(
  useClientMisplaced.length === 0,
  useClientMisplaced.length
    ? `use client placement (${useClientMisplaced.slice(0, 5).join(", ")})`
    : "use client placement OK"
)
if (useClientMisplaced.length) {
  for (const h of useClientMisplaced.slice(0, 8)) console.error("    ", h)
}

const piApi = join(root, "lib/server/payments/pi-api.ts")
assert(existsSync(piApi), "pi-api server helper exists")
const piText = readFileSync(piApi, "utf8")
assert(piText.includes("process.env.PI_API_KEY"), "PI_API_KEY read server-side")
assert(!/process\.env\.NEXT_PUBLIC_PI_API_KEY/.test(piText), "PI_API_KEY not public-prefixed")

const econ = join(root, "lib/server/economy/economic-config.ts")
assert(existsSync(econ), "economic-config exists")
const econText = readFileSync(econ, "utf8")
assert(econText.includes("VIP_PRICE_GHC = 150") || econText.includes("VIP_PRICE_GHC: 150"), "VIP 150")
assert(econText.includes("VVIP_PRICE_GHC = 300") || econText.includes("VVIP_PRICE_GHC: 300"), "VVIP 300")

assert(existsSync(join(root, "docs/architecture/AUTHORITY_MAP.md")), "AUTHORITY_MAP.md")
assert(existsSync(join(root, "docs/architecture/CONTEXT_STRANGLER_STEP4.md")), "Step4 docs")
assert(existsSync(join(root, "docs/architecture/PRODUCTION_VERIFICATION_STEP5.md")), "Step5 docs")

const migrations = [
  "supabase/migrations/20260821_ghc_economy_ledger.sql",
  "supabase/migrations/20260903_economy_v12_atomic_daily_claim.sql",
  "supabase/migrations/20260904_pi_payment_intents_durable.sql",
]
for (const m of migrations) {
  assert(existsSync(join(root, m)), `migration present: ${m.split("/").pop()}`)
}

const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"))
assert(pkg.dependencies?.next?.includes("15.5"), "Next.js 15.5.x present")
assert(/24/.test(String(pkg.engines?.node || "")), `engines.node = ${JSON.stringify(pkg.engines?.node)}`)

for (const cfg of ["next.config.mjs", "next.config.js", "next.config.ts"]) {
  const p = join(root, cfg)
  if (!existsSync(p)) continue
  const t = readFileSync(p, "utf8")
  // Fail only if explicitly set to true
  const tsIgnore = /ignoreBuildErrors\s*:\s*true/.test(t)
  const eslintIgnore = /ignoreDuringBuilds\s*:\s*true/.test(t)
  assert(!tsIgnore, `${cfg}: ignoreBuildErrors is not true`)
  assert(!eslintIgnore, `${cfg}: ignoreDuringBuilds is not true`)
}

console.log("\n=== SAFETY SCAN RESULTS ===")
console.log("Passed:", passed)
console.log("Failed:", failed)
if (failed) process.exit(1)
console.log("ALL SAFETY SCAN CHECKS PASSED\n")
