#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"
const root = process.cwd()
let fail = 0
const ok = (label, cond) => {
  if (cond) console.log(`PASS ${label}`)
  else {
    console.log(`FAIL ${label}`)
    fail++
  }
}
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8")

const disc = read("components/ghc/discovery-grid-screen.tsx")
ok("person/people grammar", disc.includes('"person"') && disc.includes('"people"'))
ok("presenceKnown on adapted", disc.includes("presenceKnown"))
ok("online filter requires presenceKnown", disc.includes("onlineOnly && presenceKnown"))
ok("presence offline honesty chip", disc.includes("Presence offline") || disc.includes("not available for these results"))
ok("self excluded via meId", disc.includes("String(meId") && disc.includes("exclude.has"))

const card = read("components/ghc/connection-card.tsx")
ok("LazyImage on connection avatars", card.includes("LazyImage"))
ok("Like is secondary style", card.includes("border-primary/40 bg-primary/10") && card.includes('action === "like"'))
ok("Connect/Message primary style", card.includes('action === "connect" || action === "accept" || action === "message"'))

const adapter = read("lib/domains/adapters/connection-graph-adapter.ts")
ok("Connect before Like in none state", adapter.includes('return ["connect", "like", "pass", "view_profile"]'))
ok("Match opportunity message primary", adapter.includes('return ["message", "connect", "like", "view_profile"]'))

const wallet = read("features/wallet/wallet-screen.tsx")
ok("no membership packs on Pi rail payment methods", !wallet.includes("membership & packs"))
ok("Pi rail honest GH Pay copy", wallet.includes("earnings withdraw and GH Pay"))

const market = read("components/ghc/marketplace-screen.tsx")
ok("own listing cart guard retained", market.includes("Remove my listings from cart"))
ok("checkout timeout retained", market.includes("45_000"))

console.log("")
console.log(`Phase 5b video gap-fill: ${14 - fail}/14 passed`)
process.exit(fail ? 1 : 0)
