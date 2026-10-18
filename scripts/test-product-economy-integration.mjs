#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"
const root = process.cwd()
let failed = 0
function ok(c, m) {
  if (c) console.log(`PASS ${m}`)
  else {
    console.log(`FAIL ${m}`)
    failed++
  }
}

ok(existsSync(join(root, "components/ghc/referral-share-card.tsx")), "ReferralShareCard")
ok(existsSync(join(root, "lib/referral/capture-ref.ts")), "capture-ref helpers")
const hub = readFileSync(join(root, "components/ghc/profile-ecosystem-hub.tsx"), "utf8")
ok(hub.includes("ReferralShareCard"), "hub embeds referral card")
const app = readFileSync(join(root, "components/ghc/app.tsx"), "utf8")
ok(app.includes("captureReferralCodeFromLocation"), "app captures ?ref=")
ok(app.includes("flushPendingReferralAttribution"), "app flushes attribution")
const cur = readFileSync(join(root, "app/api/social/posts/[id]/curation/route.ts"), "utf8")
ok(cur.includes("redistributeCurationReward"), "curation calls redistribute")
ok(cur.includes("checkRateLimit }"), "curation import intact")
ok(!cur.includes("checkRateLimit from"), "no broken import")
const fee = readFileSync(join(root, "lib/server/marketplace/listing-fee.ts"), "utf8")
ok(fee.includes("GHC_MARKETPLACE_LISTING_FEE_GHC"), "listing fee GHC env")
const com = readFileSync(join(root, "app/api/communities/route.ts"), "utf8")
ok(com.includes("quoteCommunityCreateFee"), "community fee quote")
ok(com.includes("COMMUNITY_CREATE_FEE_REQUIRED") || com.includes("FEE_VERIFIER"), "community fee gate")

if (failed) {
  console.log(`\nPRODUCT INTEGRATION: ${failed} failure(s)`)
  process.exit(1)
}
console.log("\nPRODUCT INTEGRATION: all checks passed")
