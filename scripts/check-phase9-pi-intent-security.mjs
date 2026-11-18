#!/usr/bin/env node
import { readFileSync } from "node:fs"
const read = (name) => readFileSync(name, "utf8")
const store = read("lib/server/membership/entitlement-store.ts")
const activate = read("app/api/membership/activate/route.ts")
const renewalWorkflow = read("lib/server/membership/renewal-workflow.ts")
const migration = read("supabase/migrations/20261106143001_phase9_membership_pi_renewal_strict_provider_guard.sql")
const callers = [
  "app/api/payments/fulfill/route.ts",
  "app/api/payments/intents/[intentId]/recover/route.ts",
  "app/api/payments/complete/route.ts",
].map(read)
const completeRoute = read("app/api/payments/complete/route.ts")
const fulfillRoute = read("app/api/payments/fulfill/route.ts")
const checks = [
  ["shared Pi intent predicate requires exact provider, currency, purpose and completed state", read("lib/server/membership/renewal-policy.ts").includes('intent.provider === "pi"') && read("lib/server/membership/renewal-policy.ts").includes('intent.currency === "PI"') && read("lib/server/membership/renewal-policy.ts").includes('intent.purpose === "membership"') && read("lib/server/membership/renewal-policy.ts").includes("providerPaymentId.trim().length > 0")],
  ["activation route applies strict Pi membership predicate", activate.includes("isVerifiedPiMembershipIntent(intent)")],
  ["server entitlement grant rejects incomplete Pi intent discriminators", store.includes("isVerifiedPiMembershipIntent(intent)")],
  ["payment-history recovery routes membership candidates through the strict intent predicate", store.includes(".filter((intent) => intent.purpose === 'membership')") && store.includes("isVerifiedPiMembershipIntent(intent)")],
  ["fulfillment and recovery callers forward the durable provider", callers.every((source) => source.includes("provider: ") && source.includes("tryGrantMembershipFromCompletedIntent"))],
  ["SQL rejects null provider, currency and purpose", migration.includes("i.provider IS DISTINCT FROM 'pi'") && migration.includes("coalesce(i.currency, '')") && migration.includes("i.purpose IS DISTINCT FROM 'membership'") && migration.includes("i.provider_payment_id")],
  ["SQL renewal remains service-role-only", migration.includes("REVOKE ALL ON FUNCTION public.ghc_membership_renew_from_verified_intent") && migration.includes("TO service_role")],
  ["SQL still requires completed/fulfilled intent and completion timestamp", migration.includes("i.status NOT IN ('COMPLETED', 'FULFILLED')") && migration.includes("coalesce(i.completed_at, i.fulfilled_at) IS NULL")],
  ["SQL independently validates canonical catalog product and amount", migration.includes("CANONICAL_MEMBERSHIP_PRODUCT_REQUIRED") && migration.includes("MEMBERSHIP_CATALOG_AMOUNT_MISMATCH")],
  ["strict follow-up migration is classified REVIEW_REQUIRED", read("scripts/generate-migration-inventory.mjs").includes("20261106143001_phase9_membership_pi_renewal_strict_provider_guard.sql")],
  ["database-mode Pi grants use the row-locked verified-intent renewal RPC", store.includes("if (isDatabaseConfigured())") && store.includes("renewMembershipFromVerifiedIntent({") && store.includes("never fall back to a blind upsert")],
  ["database grant is re-read and confirmed against user, tier, intent and expiry", store.includes("confirmed.userId !== userId") && store.includes("confirmed.paymentIntentId !== intent.id") && store.includes("Number(confirmed.expiresAt) <= Date.now()")],
  ["legacy tier/period metadata cannot substitute for canonical product ID", !store.includes("intent.metadata?.membershipTier") && !store.includes("intent.metadata?.billingPeriod") && store.includes("membership_(vip|vvip)_(monthly|four_months|eight_months|yearly)")],
  ["membership activation delegates to the shared verified grant workflow", activate.includes("tryGrantMembershipFromCompletedIntent({") && !activate.slice(activate.indexOf("if (method === \"pi\")"), activate.indexOf("// method === \"ghc\"")).includes("grantEntitlement({")],
  ["activation failures after payment remain recoverable and never claim success", activate.includes("paymentCompleted: true") && activate.includes("retryable: true") && activate.includes("do not pay again")],
  ["renewal workflow independently reloads and binds the durable payment intent", renewalWorkflow.includes("loadPaymentIntent(paymentIntentId)") && renewalWorkflow.includes("intent.userId !== userId") && renewalWorkflow.includes('intent.provider !== "pi"') && renewalWorkflow.includes('!String(intent.providerPaymentId || "").trim()')],
  ["complete endpoint reports payment-complete but membership-pending as retryable 503", completeRoute.includes("membershipActivationPending: true") && completeRoute.includes("paymentCompleted: true") && completeRoute.includes("status: 503") && completeRoute.includes("do not pay again")],
  ["fulfill endpoint reports membership-pending as retryable 503", fulfillRoute.includes("membershipActivationPending: true") && fulfillRoute.includes("paymentCompleted: true") && fulfillRoute.includes("status: 503") && fulfillRoute.includes("do not pay again")],
  ["payment-history reconciliation does not misreport failed grant as no orphan", store.includes("error: result.error || \"MEMBERSHIP_RECOVERY_PENDING\"") && store.includes("ok: false, recovered: false")],
]
let failed = 0
for (const [label, ok] of checks) { console.log(`${ok ? "PASS" : "FAIL"} ${label}`); if (!ok) failed++ }
console.log(`Phase 9 Pi intent security: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
