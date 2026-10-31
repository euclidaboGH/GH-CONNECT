#!/usr/bin/env node
/** Static regression checks for the reported listing/community fee and referral defects. */
import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"
const root = process.cwd()
const read = (p) => readFileSync(join(root, p), "utf8")
const checks = []
const check = (name, ok) => { checks.push({name, ok}); console.log(`${ok ? "PASS" : "FAIL"} ${name}`) }
const listingRoute = read("app/api/marketplace/listings/route.ts")
const communityRoute = read("app/api/communities/route.ts")
const feeSettlement = read("lib/server/fees/settle-pilot-fee.ts")
const referralRoute = read("app/api/referral/attribute/route.ts")
const referralUi = read("components/ghc/referral-share-card.tsx")
check("Marketplace listing fee is calculated server-side", listingRoute.includes("calculateMarketplaceListingFee"))
check("Marketplace GHC fees use authoritative settlement", listingRoute.includes("settlePilotFee("))
check("Marketplace Pi fees require intent verification", listingRoute.includes("verifyListingFeePayment("))
check("Community create fee is quoted server-side", communityRoute.includes("quoteCommunityCreateFee("))
check("Community fee settlement rejects incomplete Pi intents", feeSettlement.includes('intent.status || "").toUpperCase() !== "COMPLETED"'))
check("Referral ID lookup uses the canonical public identity resolver", referralRoute.includes("resolvePublicIdentity") && referralRoute.includes("normalizeGreenHavenId"))
check("Referral lookup no longer depends on legacy gh_profiles columns", !referralRoute.includes("gh_profiles") && !referralRoute.includes("green_haven_id"))
check("Referral attribution notification no longer points to rewards", /category:\s*"system"[\s\S]{0,120}open:\s*"profile"/.test(referralUi))
check("Release CI workflow exists", existsSync(join(root, ".github/workflows/ci.yml")))
const failed = checks.filter((c) => !c.ok)
console.log(`\nFee/referral regression checks: ${checks.length - failed.length}/${checks.length} passed`)
if (failed.length) process.exit(1)
