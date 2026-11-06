#!/usr/bin/env node
import { readFileSync } from "node:fs"
const read = (name) => readFileSync(name, "utf8")
const access = read("lib/server/membership/membership-access.ts")
const membershipDomain = read("lib/domains/membership-domain.ts")
const premiumMessaging = read("app/api/messaging/premium/route.ts")
const ledgerSpend = read("app/api/economy/ledger/spend/route.ts")
const utilitySpend = read("app/api/economy/utility/route.ts")
const checks = [
  ["server feature access resolves canonical authoritative entitlement", access.includes("tryGetEntitlementAuthoritative(uid)") && access.includes("MEMBERSHIP_STORE_UNAVAILABLE")],
  ["expired, inactive and insufficient tiers cannot pass membership gate", access.includes("entitlement.active === true") && access.includes("entitlement.expiresAt") && access.includes("allowedTiers.includes")],
  ["browser membership hasEntitlement is explicitly presentation-only", membershipDomain.includes("Presentation hint for UI/domain composition only") && membershipDomain.includes("this browser cache is never an authorization authority")],
  ["premium messaging checks required tier before any durable GHC spend", premiumMessaging.indexOf("const access = await checkMembershipTierAccess") < premiumMessaging.indexOf("const spendInput") && premiumMessaging.includes("No GHC was charged")],
  ["generic ledger spend blocks boosts/tools without durable effect before catalog debit", ledgerSpend.indexOf("UNCONFIGURED_PREMIUM_EFFECTS.has(purpose)") < ledgerSpend.indexOf("resolveSpendAmount(purposeRaw, clientAmount)") && ledgerSpend.includes("No GHC was charged")],
  ["utility purchase route independently blocks all unconfigured premium effects", utilitySpend.includes("effectNotConfigured") && utilitySpend.includes("no GHC has been charged")],
  ["boost and premium tool purposes are consistently blocked in both spend routes", ["boost", "boost_post", "boost_profile", "boost_listing", "feed_spotlight", "community_tools_month", "creator_studio_day"].every((name) => ledgerSpend.includes(`\"${name}\"`) && utilitySpend.includes(`\"${name}\"`))],
  ["membership consumer audit is registered in prebuild and static verification", ["prebuild", "verify:static"].every((key) => { const pkg = JSON.parse(read("package.json")); return pkg.scripts[key].includes("check-phase9-membership-consumer-audit.mjs") })],
]
let failed = 0
for (const [label, ok] of checks) { console.log(`${ok ? "PASS" : "FAIL"} ${label}`); if (!ok) failed++ }
console.log(`Phase 9 membership consumer audit: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
