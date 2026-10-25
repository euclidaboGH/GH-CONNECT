#!/usr/bin/env node
/** Regression contract: payment/create failures preserve the registration draft and allow retry. */
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
const root = join(fileURLToPath(new URL("..", import.meta.url)))
const modal = readFileSync(join(root, "components/ghc/create-group-modal.tsx"), "utf8")
const context = readFileSync(join(root, "contexts/ghc-context.tsx"), "utf8")
const communities = readFileSync(join(root, "components/ghc/communities-screen.tsx"), "utf8")
const chat = readFileSync(join(root, "components/ghc/chat-screen.tsx"), "utf8")
const market = readFileSync(join(root, "components/ghc/marketplace-screen.tsx"), "utf8")
const checks = [
  ["failed submit result does not reset community form", /if \(result === false\) return/.test(modal)],
  ["draft community ID is reused across retries", /formData\.id \|\| draftIdRef\.current/.test(modal) && /const suppliedId = String\(formData\.id \|\| ""\)/.test(context)],
  ["confirmed Pi fee intent is reused after a community-write failure", /communityFeePaymentByDraft\.current\.get\(proposedId\)/.test(context) && /communityFeePaymentByDraft\.current\.set\(proposedId, intentId\)/.test(context) && /communityFeePaymentByDraft\.current\.delete\(proposedId\)/.test(context)],
  ["confirmed community Pi payment locks the draft to Pi for retry", /ghc:community-fee-payment-confirmed/.test(context) && /setFeePaymentConfirmed\(true\)/.test(modal) && /feePaymentConfirmed && rail !== "PI"/.test(modal)],
  ["payment overlay transient events cannot close in-flight form", /if \(submittingRef\.current\) return/.test(modal)],
  ["communities screen shows retry guidance in the modal", /setCreateSubmitError\("Payment or server confirmation did not complete/.test(communities) && /error=\{createSubmitError\}/.test(communities)],
  ["chat group handler returns explicit success/failure", /Promise<boolean>/.test(chat) && /return false/.test(chat) && /return true/.test(chat)],
  ["marketplace preserves draft identity across payment retries", /setSellDraftId\(listingId\)/.test(market) && /setSellFeeIntentId\(intentId\)/.test(market)],
  ["marketplace fee rail remains selectable after an error", /Pay with \{rail === "GHC" \? "₲ GHC" : "π Pi"\}/.test(market) && /\{error \? <p/.test(market)],
  ["confirmed marketplace Pi fee prevents switching rails before retry", /paymentIntentId=\{sellFeeIntentId\}/.test(market) && /paymentIntentId && rail !== "PI"/.test(market)],
]
let failed = 0
for (const [label, ok] of checks) { console.log(`${ok ? "PASS" : "FAIL"} ${label}`); if (!ok) failed++ }
if (failed) process.exit(1)
console.log(`Payment retry UX contract: ${checks.length}/${checks.length} checks passed.`)
