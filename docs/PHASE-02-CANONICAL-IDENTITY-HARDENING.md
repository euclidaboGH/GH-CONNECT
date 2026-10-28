# Phase 2 — Canonical GreenHaven Identity Hardening (v0.157.0)

## Implemented in source

- Added an additive migration introducing explicit `active`, `suspended`, and `deleted` states. Existing rows default to `active`; no account is automatically suspended or deleted.
- Public-ID resolution returns only active identities. Ensure operations fail closed for a suspended/deleted identity instead of silently reactivating it or minting a replacement ID.
- Same-user ensure calls are serialized with a transaction-scoped advisory lock, preventing duplicate-create races for one canonical user. Cross-user public-ID uniqueness remains enforced by the database unique index; a race collision fails closed for retry.
- Both identity RPC calls have a five-second timeout. The server validates the returned public ID and user identity instead of coercing malformed/missing fields into strings.
- The canonical identity regression checker covers lifecycle state, RPC ACLs, request/response validation, and concurrency guardrails.

## Deployment and acceptance boundaries

The migration is additive but is **not applied** to any Supabase environment by this source change. Before deployment, reconcile remote migration history, inspect existing identity rows, and test creation, duplicate retries, collision behavior, suspension, deletion, and resolution on disposable PostgreSQL and Testnet. Validate any clients that expect suspended/deleted IDs to resolve. No production data was modified.

## Remaining Phase 2 work

This increment strengthens the existing canonical identity directory; it does not claim every Phase 2 roadmap item is complete. Legacy identity backfill/reconciliation, all referral and account-linking edge cases, full two-account authorization testing, and operational recovery evidence remain explicit acceptance tasks.
