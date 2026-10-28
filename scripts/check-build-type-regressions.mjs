#!/usr/bin/env node
/** Source-level guard for recurring Vercel/GitHub Actions TypeScript regressions. */
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { dirname } from "node:path"
const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const read = (path) => readFileSync(join(root, path), "utf8")
const checks = []
const test = (name, ok) => { checks.push(Boolean(ok)); console.log(`${ok ? "PASS" : "FAIL"} ${name}`) }
const wallet = read("lib/domains/wallet-v2.ts")
const screen = read("features/wallet/wallet-screen.tsx")
const orders = read("app/api/payments/orders/route.ts")
const reports = read("app/api/governance/reports/route.ts")
const ci = read(".github/workflows/ci.yml")
test("wallet snapshot explicitly maps every required numeric field", ["available", "pending", "locked", "escrowLocked", "ledgerBalance", "lifetimeEarned", "lifetimeSpent", "lifetimePurchased"].every((field) => new RegExp(`\\b${field}: amounts\.${field}\\b`).test(wallet)))
test("wallet intent response list is typed as unknown[] before normalization", /const list: unknown\[\] \| null/.test(screen) && /filter\(\(x\): x is PiTransactionProjection => x !== null\)/.test(screen) && /type PiTransactionProjection/.test(screen))
test("payment order metadata is narrowed to a record and arrays rejected", /body\.metadata as Record<string, unknown>/.test(orders) && /!Array\.isArray\(body\.metadata\)/.test(orders))
test("donation amount rejects booleans and non-decimal coercion", /validAmountType/.test(orders) && /typeof rawAmount === "number"/.test(orders) && /\\d\{1,6\}/.test(orders))
test("governance report is narrowed before communityId and id access", /if \(!candidate \|\| typeof candidate !== "object" \|\| Array\.isArray\(candidate\)\)/.test(reports) && /const report = candidate as Record<string, unknown>/.test(reports))
test("CI uses Node-24-compatible action majors", /actions\/checkout@v5/.test(ci) && /actions\/setup-node@v5/.test(ci))
test("CI OS image is pinned against ubuntu-latest migration drift", /runs-on: ubuntu-24\.04/.test(ci))
const failed = checks.filter((ok) => !ok).length
console.log(`\nBuild type-regression guard: ${checks.length - failed}/${checks.length} passed`)
process.exit(failed ? 1 : 0)
