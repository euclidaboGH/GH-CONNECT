# GreenHaven upgrade worklog — 0.195.0

## Phase 18 — marketplace payment evidence binding

### Change
- Tightened marketplace PI order payment verification to require a server-side intent with provider `pi`, currency `PI`, purpose `marketplace`, an order-specific reference, and a finite amount matching the durable order total.
- Tightened shared community PI fee settlement to require provider=`pi`, explicit PI currency, the dedicated community-create purpose/metadata, and either an exact intent reference or an explicit matching community binding. Missing currency/reference values no longer inherit trusted defaults.
- Removed browser-supplied `paymentId` and `txid` fallback. Those fields are now sourced only from the persisted server-side payment intent.
- Normalized order currency is used consistently for PI payment amount validation.
- Added `check-phase18-marketplace-payment-binding.mjs` and wired it into `verify:static` and `prebuild`.

### Security rationale
A browser may submit arbitrary payment identifiers or hashes. Those values must never become payment evidence when the authoritative Pi provider callback/intent has not persisted them. Binding the intent to provider, currency, purpose, reference, owner, status and amount prevents cross-purpose/cross-currency/cross-order intent reuse.

### Scope and limitations
- This is a source-level hardening increment. It does not execute a Pi SDK payment or contact Pi Testnet.
- It does not change GHC ledger authority, commission rates, seller payout accounting, inventory reservations, or business rules.
- A completed intent must still be produced by the existing authenticated server-side provider lifecycle.
- Runtime TypeScript, ESLint, Next.js build, disposable PostgreSQL, and authenticated Testnet checkout remain separate release gates.

### Validation
Run `node scripts/check-phase18-marketplace-payment-binding.mjs` and `npm run verify:static` under the required Node 24.15.0+ environment.
