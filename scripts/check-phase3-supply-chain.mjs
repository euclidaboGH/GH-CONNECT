#!/usr/bin/env node
/**
 * Phase 3 — supply chain review gates for pinned third-party SDKs and install policy.
 */
import { readFileSync, existsSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"))
const lockPath = join(root, "package-lock.json")
const lock = existsSync(lockPath) ? JSON.parse(readFileSync(lockPath, "utf8")) : null

const checks = []
const ok = (name, pass, detail = "") => checks.push({ name, pass: Boolean(pass), detail })

// pi-backend official pin
ok("pi-backend dependency is 0.1.3", pkg.dependencies?.["pi-backend"] === "0.1.3")
if (lock) {
  const entry = lock.packages?.["node_modules/pi-backend"]
  ok("pi-backend present in lockfile", Boolean(entry))
  ok("pi-backend lock version 0.1.3", entry?.version === "0.1.3")
  ok(
    "pi-backend resolves from registry.npmjs.org",
    typeof entry?.resolved === "string" && entry.resolved.includes("registry.npmjs.org/pi-backend"),
  )
} else {
  ok("package-lock.json present", false, "lockfile missing")
}

// @swetate/* — local/private packages at 0.1.0; flag if unpinned range sneaks in
for (const name of ["@swetate/auth", "@swetate/core", "@swetate/user-state"]) {
  const ver = pkg.dependencies?.[name]
  ok(`${name} is exact 0.1.0 (no range)`, ver === "0.1.0", ver ? `found ${ver}` : "missing")
}

// Install policy: document legacy-peer-deps still required
const vercel = existsSync(join(root, "vercel.json"))
  ? readFileSync(join(root, "vercel.json"), "utf8")
  : ""
const ci = existsSync(join(root, ".github/workflows/ci.yml"))
  ? readFileSync(join(root, ".github/workflows/ci.yml"), "utf8")
  : ""
ok("CI still documents legacy-peer-deps (tracked debt)", /legacy-peer-deps/.test(ci))
ok("Vercel install still uses legacy-peer-deps (tracked debt)", /legacy-peer-deps/.test(vercel))

// Dependabot present
ok("Dependabot config present", existsSync(join(root, ".github/dependabot.yml")))

// engines
ok("engines.node is 24.15 line", typeof pkg.engines?.node === "string" && /24\.15/.test(pkg.engines.node))

// lint ratchet progressing
const lint = pkg.scripts?.lint || ""
const maxWarn = lint.match(/--max-warnings\s+(\d+)/)
ok("lint max-warnings ratcheted below 1000", maxWarn && Number(maxWarn[1]) < 1000, lint)

let failed = 0
for (const c of checks) {
  console.log(`${c.pass ? "PASS" : "FAIL"} ${c.name}${c.detail ? " — " + c.detail : ""}`)
  if (!c.pass) failed++
}
console.log(`\nPhase 3 supply chain: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
