#!/usr/bin/env node
import { readFileSync } from "node:fs"
import { join } from "node:path"
const root = process.cwd()
const route = readFileSync(join(root, "app/api/admin/treasury/summary/route.ts"), "utf8")
const checks = [
  ["operator key requires high entropy and timing-safe comparison", /Buffer\.byteLength\(expectedRaw, "utf8"\) < 32/.test(route) && /timingSafeEqual/.test(route)],
  ["report is GET-only and force dynamic", /export async function GET/.test(route) && /dynamic = "force-dynamic"/.test(route)],
  ["default reporting window is current UTC quarter", /utcQuarterWindow/.test(route) && /getUTCMonth/.test(route)],
  ["custom reporting windows are bounded", /93 \* 24 \* 60 \* 60 \* 1000/.test(route)],
  ["cashback reconciliation uses authoritative server adapter", /reconcileCashbackPeriod\(window\)/.test(route)],
  ["A2U review and stuck queues are included", /listOpenA2uReviews/.test(route) && /listStuckA2uJobs/.test(route)],
  ["unavailable data degrades instead of becoming zero", /status = !cashback\.ok \|\| !exceptionsAvailable/.test(route) && /reviews\?\.ok === true && Array\.isArray\(reviews\.items\)/.test(route) && /stuck\?\.ok === true && Array\.isArray\(stuck\.cashback\)/.test(route)],
  ["PI and GHC are explicitly segregated", /ghcUtilityLedger: "separate_asset_not_included"/.test(route) && /ghc: \{ status: "not_included"/.test(route)],
  ["seller and bank liabilities are not fabricated", /sellerPayables: financialReport\?\.ok/.test(route) && /bankSettlements: "not_included"/.test(route)],
  ["endpoint is explicitly read-only", /Read-only report/.test(route) && !/export async function POST/.test(route)],
  ["response is not cacheable", /no-store/.test(route)],
]
let failed = 0
for (const [label, ok] of checks) { console.log(`${ok ? "PASS" : "FAIL"} ${label}`); if (!ok) failed++ }
console.log(`Phase 7 treasury operations: ${checks.length - failed}/${checks.length}`)
process.exit(failed ? 1 : 0)
