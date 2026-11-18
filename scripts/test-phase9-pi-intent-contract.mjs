#!/usr/bin/env node
import { isVerifiedPiMembershipIntent } from "../lib/server/membership/renewal-policy.ts"

const base = { provider: "pi", currency: "PI", purpose: "membership", status: "COMPLETED", providerPaymentId: "pi-payment-123" }
const cases = [
  ["accepts exact completed Pi membership intent", isVerifiedPiMembershipIntent(base) === true],
  ["accepts exact fulfilled Pi membership intent", isVerifiedPiMembershipIntent({ ...base, status: "FULFILLED" }) === true],
  ["rejects missing provider", isVerifiedPiMembershipIntent({ ...base, provider: undefined }) === false],
  ["rejects non-Pi provider", isVerifiedPiMembershipIntent({ ...base, provider: "manual" }) === false],
  ["rejects missing currency", isVerifiedPiMembershipIntent({ ...base, currency: undefined }) === false],
  ["rejects GHC currency", isVerifiedPiMembershipIntent({ ...base, currency: "GHC" }) === false],
  ["rejects missing purpose", isVerifiedPiMembershipIntent({ ...base, purpose: undefined }) === false],
  ["rejects missing provider payment binding", isVerifiedPiMembershipIntent({ ...base, providerPaymentId: undefined }) === false],
  ["rejects blank provider payment binding", isVerifiedPiMembershipIntent({ ...base, providerPaymentId: "   " }) === false],
  ["rejects non-membership purpose", isVerifiedPiMembershipIntent({ ...base, purpose: "premium_feature" }) === false],
  ["rejects approved but incomplete payment", isVerifiedPiMembershipIntent({ ...base, status: "APPROVED" }) === false],
  ["rejects failed payment", isVerifiedPiMembershipIntent({ ...base, status: "FAILED" }) === false],
]
let failed = 0
for (const [name, ok] of cases) { console.log(`${ok ? "PASS" : "FAIL"} ${name}`); if (!ok) failed++ }
console.log(`Phase 9 strict Pi intent contract: ${cases.length - failed}/${cases.length} passed`)
if (failed) process.exit(1)
