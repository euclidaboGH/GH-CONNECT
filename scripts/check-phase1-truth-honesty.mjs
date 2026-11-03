#!/usr/bin/env node
/**
 * Phase 1 — Truth & honesty regression (source contracts).
 * Communities My filters, Discover follow path, marketplace own-buy humanization,
 * wallet earnings load timeout + Retry.
 */
import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
let fail = 0
function ok(label, cond) {
  if (cond) console.log(`PASS ${label}`)
  else {
    console.log(`FAIL ${label}`)
    fail++
  }
}
function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8")
}

const communities = read("components/ghc/communities-screen.tsx")
ok("My tab skips discover privacy/category filters", communities.includes('directory === "discover"') && communities.includes("categoryFilter !== \"all\""))
ok("Honest empty copy for Discover when already in all", communities.includes("You're already in every community we found"))
ok("Membership seed from remote owner/members", communities.includes("setLocalJoined") && communities.includes("createdBy === me"))

const discovery = read("components/ghc/discovery-grid-screen.tsx")
ok("Discover follow uses context followUser", discovery.includes("ghc.followUser") && discovery.includes("prefer context followUser"))
ok("Discovery candidate dedupe by id", discovery.includes("stable dedupe by person id") || discovery.includes("seen.has(id)"))

const market = read("components/ghc/marketplace-screen.tsx")
ok("Marketplace humanizeClientErrorCode import", market.includes("humanizeClientErrorCode"))
ok("Cart blocks own listings client-side", market.includes("purchasableItems") && market.includes("ownItems"))
ok("Checkout disabled when only own items", market.includes("purchasableItems.length === 0"))
ok("Own listing cart copy", market.includes("can't be purchased") || market.includes("You can't buy your own listing"))

const safe = read("lib/client/safe-api-error.ts")
ok("CANNOT_BUY_OWN humanized", safe.includes("CANNOT_BUY_OWN") && safe.includes("You can't buy your own listing"))
ok("WALLET_AUTHORIZATION_REQUIRED humanized", safe.includes("WALLET_AUTHORIZATION_REQUIRED"))

const earnings = read("components/ghc/unified-earnings-dashboard.tsx")
ok("Earnings hard timeout 12s", earnings.includes("12_000") && earnings.includes("setFailed(true)"))
ok("Earnings Retry control present", earnings.includes("Retry") && earnings.includes("setLoading(true)"))

console.log("")
console.log(`Phase 1 truth honesty: ${13 - fail}/13 passed`)
process.exit(fail ? 1 : 0)
