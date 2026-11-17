#!/usr/bin/env node
/** Regression guard: bounded request parsing must be imported as executable code. */
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { dirname } from "node:path"
const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const source = readFileSync(join(root, "app/api/economy/ledger/spend/route.ts"), "utf8")
const checks = [
  ["bounded JSON helper is imported after the route header comment", /^\/\*[\s\S]*?\*\/\s*import \{ readBoundedJson \} from "@\/lib\/server\/http\/read-bounded-json"/m.test(source)],
  ["bounded JSON helper is called by POST", /export async function POST\(request: Request\)[\s\S]*?readBoundedJson\(request,\s*8192\)/.test(source)],
  ["oversized requests receive HTTP 413", /REQUEST_TOO_LARGE[\s\S]*?\? 413 : 400/.test(source)],
]
for (const [name, ok] of checks) console.log(`${ok ? "PASS" : "FAIL"} ${name}`)
console.log(`\nSpend bounded JSON import regression: ${checks.filter(([, ok]) => ok).length}/${checks.length} passed`)
if (checks.some(([, ok]) => !ok)) process.exit(1)
