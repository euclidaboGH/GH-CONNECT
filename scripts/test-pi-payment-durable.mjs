/**
 * PROMPT #25 — Durable Pi payment intent + incomplete recovery tests
 * Pure node — no live Pi network required.
 */
import { createRequire } from "module"
import { readFileSync, existsSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, "..")
let passed = 0
let failed = 0

function assert(cond, msg) {
  if (cond) {
    passed++
    console.log("  ✓", msg)
  } else {
    failed++
    console.log("  ✗", msg)
  }
}

console.log("\n1. Migration + source artifacts")
const mig = join(root, "supabase/migrations/20260904_pi_payment_intents_durable.sql")
assert(existsSync(mig), "durable migration exists")
const sql = readFileSync(mig, "utf8")
assert(sql.includes("ghc_payment_intents"), "table ghc_payment_intents")
assert(sql.includes("uq_ghc_payment_intents_provider_payment"), "unique provider payment id")
assert(sql.includes("SECURITY DEFINER"), "security definer RPCs")
assert(sql.includes("SET search_path = public"), "search_path fixed")
assert(sql.includes("FOR ALL USING (false)"), "RLS deny client writes")

const store = readFileSync(join(root, "lib/server/payments/intent-store.ts"), "utf8")
assert(store.includes("ghc_payment_intent_upsert"), "store persists via RPC")
assert(store.includes("loadPaymentIntent"), "async durable load")
assert(store.includes("loadByProviderPaymentId"), "load by Pi payment id")
assert(store.includes("markIntentFulfilled"), "fulfillment marker")
assert(store.includes("PAYMENT_STATUS_RANK") || store.includes("TRANSITION_BLOCKED"), "transition guards")

const types = readFileSync(join(root, "lib/server/payments/intent-types.ts"), "utf8")
assert(types.includes("FULFILLED"), "FULFILLED status")
assert(types.includes("INCOMPLETE"), "INCOMPLETE status")

console.log("\n2. Incomplete recovery route + client")
assert(existsSync(join(root, "app/api/payments/incomplete/route.ts")), "incomplete API route")
const inc = readFileSync(join(root, "app/api/payments/incomplete/route.ts"), "utf8")
assert(inc.includes("resolveAuthenticatedUser"), "auth required")
assert(inc.includes("piGetPayment"), "Pi API reconciliation")
assert(inc.includes("amount_mismatch") || inc.includes("AMOUNT_mismatch"), "amount guard")
assert(inc.includes("already_completed") || inc.includes("already_fulfilled"), "idempotent terminal")
assert(inc.includes("piCompletePayment"), "can complete incomplete with txid")
assert(!inc.includes("NEXT_PUBLIC_PI_API"), "no public API key")

assert(existsSync(join(root, "lib/pi-incomplete-payment.ts")), "client incomplete helper")
const client = readFileSync(join(root, "lib/pi-incomplete-payment.ts"), "utf8")
assert(client.includes("onIncompletePaymentFound"), "export onIncompletePaymentFound")
assert(client.includes("/api/payments/incomplete"), "posts to recovery endpoint")

console.log("\n3. Approve/complete/fulfill durable loads")
const appr = readFileSync(join(root, "app/api/payments/approve/route.ts"), "utf8")
assert(appr.includes("loadPaymentIntent"), "approve loads durable")
const comp = readFileSync(join(root, "app/api/payments/complete/route.ts"), "utf8")
assert(comp.includes("loadPaymentIntent"), "complete loads durable")
const ful = readFileSync(join(root, "app/api/payments/fulfill/route.ts"), "utf8")
assert(ful.includes("markIntentFulfilled"), "fulfill marks durable")

console.log("\n4. Secrets")
assert(!store.includes("NEXT_PUBLIC_PI_API_KEY"), "store has no public key")
assert(!inc.includes("process.env.PI_API_KEY") || inc.includes("getPiApiKey"), "key via server helper only")

console.log("\n5. Active auth path wires incomplete callback")
const authCtx = readFileSync(join(root, "contexts/pi-auth-context.tsx"), "utf8")
assert(authCtx.includes("onIncompletePaymentFound"), "pi-auth-context imports/uses onIncompletePaymentFound")
assert(authCtx.includes("authenticate"), "pi-auth-context calls authenticate")
assert(authCtx.includes('["username", "payments"]') || authCtx.includes("username") && authCtx.includes("payments"), "payments scope requested")
const piTs = readFileSync(join(root, "lib/pi.ts"), "utf8")
assert(piTs.includes("onIncompletePaymentFound"), "createSdk login path references incomplete handler")
const orderStore = readFileSync(join(root, "lib/gh-pay/order-store.ts"), "utf8")
assert(orderStore.includes("NON-AUTHORITATIVE"), "order-store documented non-authoritative")
const store2 = readFileSync(join(root, "lib/server/payments/intent-store.ts"), "utf8")
assert(store2.includes("assertDurableWrite") || store2.includes("DURABLE_REQUIRED"), "production fail-closed durable write")

console.log("\n=== RESULTS ===")
console.log(`Passed: ${passed}`)
console.log(`Failed: ${failed}`)
if (failed > 0) process.exit(1)
console.log("ALL PI DURABLE PAYMENT TESTS PASSED")
