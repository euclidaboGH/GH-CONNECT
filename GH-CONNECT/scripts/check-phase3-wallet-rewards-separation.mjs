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

const wallet = read("features/wallet/wallet-screen.tsx")
ok("no primary Buy GHC with π chrome", !wallet.includes("Buy GHC with π"))
ok("no inline GhPayPanel on wallet screen", !wallet.includes("GhPayPanel"))
ok("Add GHC packs CTA opens sheet", wallet.includes("Open packs") && wallet.includes("setShowAddGhc(true)"))
ok("rewards tab is redirect-only", wallet.includes("Open Rewards Centre") && !wallet.includes("rewards.map((r)"))
ok("Earn tab label", wallet.includes('label: "Earn"'))
ok("membership not paid on balance card copy", wallet.includes("VIP plans open on Membership"))
ok("money & benefits separation copy", wallet.includes("Claims open in Rewards") && wallet.includes("VIP plans open in Membership"))
ok("pending hold release wording", wallet.includes("Release to available balance"))
ok("send educate points to Rewards for matured claims", wallet.includes("claim matured rewards in Rewards") || wallet.includes("Pending holds mature"))

const rewards = read("components/ghc/rewards-centre-screen.tsx")
ok("registration bonus on rewards", rewards.includes("RegistrationBonusCard"))
ok("withdraw path navigates to wallet", rewards.includes("Open Wallet · Withdraw Pi"))
ok("claims stay on rewards copy", rewards.includes("Claims stay here") || rewards.includes("claimed here"))

const membership = read("components/ghc/premium-membership-screen.tsx")
ok("membership screen still exists", membership.length > 500)

console.log("")
console.log(`Phase 3 wallet/rewards separation: ${13 - fail}/13 passed`)
process.exit(fail ? 1 : 0)
