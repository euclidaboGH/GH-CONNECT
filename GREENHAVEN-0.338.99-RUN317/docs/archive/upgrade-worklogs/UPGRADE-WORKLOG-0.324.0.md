# Upgrade Worklog — 0.324.0

## Phase 9 Membership foundation

- Began Product Phase 9 using the 0.323.0 Rewards-complete archive as the source baseline.
- Introduced `lib/server/membership/entitlement-row.ts` as a strict pure parser for privileged membership rows.
- Closed a critical fail-open edge: a malformed/missing expiry on a paid VIP/VVIP row can no longer be interpreted as an unbounded entitlement. Only explicitly complimentary records may be non-expiring.
- Enforced row-to-requested-user identity matching, known tier/source/billing-period allowlists, strict active booleans, timestamp integrity and bounded audit projection.
- Expired/inactive paid entitlements normalize to Free for product access presentation.
- Bounded authoritative Supabase membership reads and client status hydration to eight seconds; timeout/store errors remain unavailable, not Free.
- Rejected conflicting membership duration aliases before entering GHC or Pi purchase flows.
- Preserved server-catalog pricing, exact Pi product binding, durable completed-intent requirement, authenticated ownership and separate GHC/Pi rails.
- Added 14 runtime parser assertions and 18 Phase 9 source-contract checks; registered both in prebuild and verify:static.
- No SQL migration, provider integration, financial execution authority or live configuration was changed.

## Verification boundaries

- The release evidence here is source-level and source-only; it does not establish production acceptance.

- Node 22.16.0 is available, while the repository requires Node 24.15.0. Runtime-gated TypeScript, ESLint and Next.js production build are not certified in this environment.
- No dependency installation, database migration, Pi Testnet/Mainnet transaction, GHC debit, provider operation or production deployment was performed.
- Phase 9 is active; this release is a source foundation increment, not a complete Membership milestone or production approval.
