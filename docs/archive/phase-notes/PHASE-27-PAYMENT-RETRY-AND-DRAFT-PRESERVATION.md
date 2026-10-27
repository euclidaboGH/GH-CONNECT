# GH-CONNECT v0.90.9 — Payment retry and draft preservation

## Scope
Surgical UX/reliability fixes for community/group creation and marketplace listing fees after payment failures.

## Changes
- `CreateGroupModal` now interprets an explicit `false` submit result as failure and does not reset form fields or step progress. The form resets only after the parent confirms success.
- A stable community draft ID is generated once per modal draft and reused for subsequent attempts, binding payment intent idempotency and server creation retries to the same community identity.
- The transient UI coordinator no longer closes the create-group form while its payment/create submission is in progress. Explicit navigation can close it after the operation ends.
- The Communities screen surfaces a persistent in-modal recovery message with retry and payment-status guidance.
- Chat-screen group creation returns explicit success/failure so payment/create errors do not masquerade as success to the modal.
- A successfully completed Pi community-fee intent is retained in provider memory for that draft. If durable community creation fails after payment succeeds, retry reuses that confirmed intent instead of initiating another Pi payment. The modal receives a confirmation event, locks the draft to Pi, and displays a retry-specific message; the cached binding is cleared after durable creation.
- Marketplace listing form already retained draft fields, listing ID and successful Pi fee intent on failure; added regression coverage to guard this retry path and fee-rail availability.
- Added `scripts/check-payment-retry-ux.mjs` to the static verification suite; release version synchronized to `0.90.9`.

## Validation performed
- Payment retry UX contract: 10/10 static checks passed.
- Full static verification: 11/11 suites passed.
- ZIP integrity checked after packaging.

## Not claimed / operator validation required
- No local Next.js build or TypeScript run: this environment has Node.js 22.16.0 and no installed `node_modules`; project runtime requires Node 24.15.0 or newer within the declared range.
- No live Pi Browser, GHC ledger, Supabase or Vercel testnet transaction was executed here.
- The successful Pi intent cache is in-memory. If the browser/app reloads after payment success but before durable community creation, the user should verify payment status before retrying; durable server-side recovery is a separate follow-up requiring review of payment-intent status APIs and database constraints.
- Existing security and server-side fee settlement remain authoritative. No client-side balance, payment-success, or listing/community authority was introduced.
