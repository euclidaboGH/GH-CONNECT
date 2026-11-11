#!/usr/bin/env node
import fs from "node:fs"
const path = "docs/PROJECT-WIDE-MAINTENANCE-150-0.330.47.md"
const source = fs.readFileSync(path, "utf8")
const headings = [...source.matchAll(/^### (\d+)\. (.+)$/gm)]
const checks = []
const test = (name, ok) => { checks.push(Boolean(ok)); console.log(`${ok ? "PASS" : "FAIL"} ${name}`) }
test("maintenance register exists", source.length > 12000)
test("exactly 15 numbered sections", headings.length === 15)
test("section numbers are ordered 1–15", headings.every((m, i) => Number(m[1]) === i + 1))
let total = 0
for (const [i, heading] of headings.entries()) {
  const start = heading.index + heading[0].length
  const end = headings[i + 1]?.index ?? source.length
  const body = source.slice(start, end)
  const items = [...body.matchAll(/^- \[ \] \*\*(\d{2})\.\*\*/gm)]
  total += items.length
  test(`section ${i + 1} (${heading[2]}) has ten ordered essentials`, items.length === 10 && items.every((m, n) => Number(m[1]) === n + 1))
}
test("exactly 150 essentials are registered", total === 150)
test("financial authority guardrail is explicit", /No client-side minting, settlement, transfer execution, refund, payout or entitlement grants/.test(source))
test("migration approval and target reconciliation guardrail is explicit", /reconcile Testnet and Mainnet independently/i.test(source))
test("production status is not overstated", /Production remains NOT APPROVED/.test(source))
const failed = checks.filter(x => !x).length
console.log(`\nMaintenance register contract: ${checks.length - failed}/${checks.length} passed; ${total}/150 essentials counted`)
process.exit(failed ? 1 : 0)
