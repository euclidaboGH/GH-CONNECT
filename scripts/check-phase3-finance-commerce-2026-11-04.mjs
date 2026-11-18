#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"
const root = process.cwd()
let pass = 0, fail = 0
function ok(n, c, d="") {
  if (c) { pass++; console.log("PASS", n) }
  else { fail++; console.log("FAIL", n, d) }
}
const mkt = join(root, "components/ghc/marketplace-screen.tsx")
const client = join(root, "lib/social/client.ts")
const doc = join(root, "docs/PHASE-3-FINANCE-COMMERCE-2026-11-04.md")
ok("marketplace screen exists", existsSync(mkt))
const t = existsSync(mkt) ? readFileSync(mkt, "utf8") : ""
ok("checkout progress state", t.includes("checkoutProgress"))
ok("reserve progress copy", t.includes("Reserving") && t.includes("of"))
ok("GHC pay progress copy", t.includes("Paying GHC"))
ok("multi-Pi remaining message", t.includes("more Pi order"))
ok("partial failure reserved note", t.includes("may already be reserved"))
ok("idempotency keys retained narrative", t.includes("cart line keys") || t.includes("line keys"))
ok("90s cart timeout", t.includes("90_000"))
ok("own listing still blocked", t.includes("isOwnedByCurrentUser"))
const c = existsSync(client) ? readFileSync(client, "utf8") : ""
ok("order mutation longer timeout", c.includes("isOrderMutation") && c.includes("45_000"))
const earn = join(root, "components/ghc/unified-earnings-dashboard.tsx")
const et = existsSync(earn) ? readFileSync(earn, "utf8") : ""
ok("earnings uses apiRequest", et.includes("apiRequest"))
ok("quote via apiRequest path", et.includes('/api/economy/earnings/quote') && et.includes("apiRequest"))
ok("withdraw request via apiRequest", et.includes("earnings/withdrawals") && et.includes("apiRequest"))
ok("phase 3 doc", existsSync(doc))
console.log(`\nPhase 3 finance/commerce: ${pass}/${pass+fail} passed`)
process.exit(fail ? 1 : 0)
