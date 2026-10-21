# Phase 5–6 Massive Hardening — Implementation Report

## Scope

This source-only rework closes several cross-layer correctness gaps in payment intent durability, media storage ownership, withdrawal eligibility, and messaging failure handling. No remote database or provider was contacted.

## Implemented changes

### Payment intent durability

- Added `ghc_payment_intent_by_idempotency` as a service-role-only RPC, backed by the existing unique `(user_id, idempotency_key)` index.
- Added row-locked `ghc_payment_intent_bind_provider` and `ghc_payment_intent_transition` RPCs so provider identity and status changes serialize in PostgreSQL instead of racing through stale whole-row upserts. Status transitions cannot silently bind a provider ID; binding must succeed through the dedicated conflict-checked RPC first. Confirmed completed payments cannot regress to failed, cancelled or incomplete states.
- Explicitly revoked client-role execution of the original `SECURITY DEFINER` payment-intent RPCs and granted execution to `service_role` only; table RLS alone was not sufficient to protect privileged RPC return values.
- Added a read-only post-migration SQL assertion file and a concurrency/recovery plan for idempotency races, provider-binding conflicts, terminal-state regression, txid collisions and interrupted provider completion.
- Payment intent creation now looks up idempotency keys in durable storage, validates that reuse has the same user, purpose, amount, currency, provider and reference, and handles the concurrent-create race by re-reading the winning durable row.
- Production synchronous getters no longer return process-memory payment intents. Production listings/recovery helpers do not treat process memory as durable authority.
- Failed durable writes no longer update the cache first, and provider binding no longer returns an intent after a failed durable write.
- Payment intent RPC calls have an eight-second deadline. Approve/complete actions now fail closed when provider lookup is unavailable, and an idempotent approval request does not resubmit approval after the intent is already completed/fulfilled.

### Media storage correctness and security

- Unified both proxy and signed direct uploads on the schema-compatible path format `{ownerId}/{category}/{uuid}.{extension}`. This now matches the existing database ownership constraint and viewer authorization function.
- Added shared `lib/server/media/path-policy.mjs` validation for owner IDs, buckets, categories, UUID filenames, MIME/extension consistency, byte sizes and dimensions/duration metadata.
- Direct upload completion now rejects malformed size metadata and does not mark an asset ready unless the storage object can be verified and its reported size matches the client declaration.
- Removed the direct service-role table-insert fallback when the asset RPC is missing or rejects a record. A missing migration or rejected RPC now fails closed instead of bypassing the intended validation boundary.
- Added request deadlines to media storage metadata calls.

### Withdrawal eligibility

- A failed locked-balance query now returns an unavailable result rather than pretending zero GHC is locked.
- The withdrawal quote endpoint now returns `503` if the wallet snapshot, locked balance or withdrawal history cannot be read safely. It no longer substitutes a zero balance or empty history for an unavailable database response.
- Withdrawal RPC and history requests have bounded deadlines.

### Messaging resilience

- Conversation listing returns no durable conversation data when membership/conversation queries fail instead of falling through to potentially stale process-memory previews.
- Member roster lookup returns an empty result on database failure and never uses in-memory membership as a production fallback when the database is configured.
- Messaging data requests have an eight-second deadline.

## Verification

- New Phase 5–6 hardening suite: 71 checks passed.
- Phase 5 financial integrity suite: 11/11 passed.
- Durable Pi payment/recovery suite: 54 assertions passed.
- Phase 6 media/messaging/realtime suite: 16/16 passed.
- Private media/account suite: 14/14 passed.
- Media/financial foundation suite: 18/18 passed.
- Media route hardening and upload-compression suites passed.

These are source and local regression tests. TypeScript, lint and production build are not verified because the working environment has no installed project dependencies and the available Node runtime is below the pinned Node 24.15.0 runtime. Real Supabase object-info response compatibility, disposable PostgreSQL concurrency tests, Pi/Paystack sandbox tests, and multi-account messaging tests remain unverified. The three new payment-intent migrations must be reviewed and applied to the appropriate empty Testnet project before deploying code that uses them. The SQL assertions and concurrency plan still need to be executed against disposable PostgreSQL/Testnet; source tests do not validate database locking or ACL runtime behavior. No Supabase or Vercel action was taken.
