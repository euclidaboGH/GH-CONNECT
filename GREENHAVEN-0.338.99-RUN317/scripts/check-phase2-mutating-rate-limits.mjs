#!/usr/bin/env node
/**
 * Phase 2 inventory: mutating API routes that do not reference durable rate limiting.
 * Not a hard fail gate yet — produces a report for operators.
 */
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"

const root = join(import.meta.dirname, "..")
const apiRoot = join(root, "app", "api")

const MUTATING = /\b(POST|PUT|PATCH|DELETE)\s*\(/
const RATE = /checkDurableRateLimit|checkRateLimit|durableRateLimit|userRateLimit|authRateLimit|rateLimit/

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) walk(p, out)
    else if (name === "route.ts" || name === "route.js") out.push(p)
  }
  return out
}

const routes = walk(apiRoot)
const mutatingWithout = []
const mutatingWith = []
const nonMutating = []

for (const file of routes) {
  const src = readFileSync(file, "utf8")
  const rel = relative(root, file)
  if (!MUTATING.test(src)) {
    nonMutating.push(rel)
    continue
  }
  if (RATE.test(src)) mutatingWith.push(rel)
  else mutatingWithout.push(rel)
}

console.log(`API route files: ${routes.length}`)
console.log(`Mutating with rate-limit reference: ${mutatingWith.length}`)
console.log(`Mutating WITHOUT rate-limit reference: ${mutatingWithout.length}`)
console.log(`Non-mutating (GET/HEAD only or no handlers matched): ${nonMutating.length}`)
console.log("\n--- Mutating routes missing durable/local rate-limit reference ---")
for (const r of mutatingWithout.sort()) console.log(r)

// Soft gate: fail only if count is extremely high (placeholder threshold)
if (mutatingWithout.length > 200) {
  console.error("\nFAIL: unexpectedly high number of unlimited mutating routes")
  process.exit(1)
}
console.log("\nPASS inventory completed (informational; apply limits on money/auth paths first)")
