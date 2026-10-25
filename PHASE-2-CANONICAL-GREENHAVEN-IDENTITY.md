# Phase 2 — Canonical GreenHaven Identity (v0.91.9)

## Scope

Phase 2 makes referral attribution resolve GreenHaven IDs through the same durable identity directory used by GHC transfer recipient resolution and the authenticated public-ID endpoint.

## Defect addressed

The referral API previously searched a sequence of legacy columns in `gh_profiles`. PostgREST queries against missing columns were skipped, and a valid identity stored in `ghc_public_identities` could therefore be reported as invalid. This created two competing identity-resolution paths.

## Implementation

- Referral IDs are normalized with the shared GreenHaven ID normalizer and checked against the canonical `GH-XXXXXX` format.
- Referral attribution resolves through `resolvePublicIdentity`, the same server-side identity service used by transfer resolution.
- Legacy table/column probing was removed from the referral endpoint.
- Self-referral checks, one-time attribution, referral-code creation, and server-side reward rules remain unchanged.
- Canonical public identity database constraints and service-role-only RPC writes remain unchanged; no client-side identity writes or auth bypasses were added.
- Package/release version advanced to `0.91.9`.

## Verification completed

- `node scripts/check-phase2-canonical-identity.mjs` — 9/9 passed.
- `node scripts/test-fee-referral-contract.mjs` — 9/9 passed.
- `node scripts/check-release-hygiene.mjs` — 11/11 passed.

These are source-level checks, not a live Supabase or production build verification. Node.js `^24.15.0` is required. The environment used for this source review does not establish that the Testnet migration was applied or that its service-role RPCs are reachable.

## Testnet release checklist

1. Confirm migration `20261022010004_ghc_public_identities.sql` has been applied to the correct Supabase Testnet project.
2. Confirm Vercel Testnet has `SUPABASE_URL` (or `NEXT_PUBLIC_SUPABASE_URL`) and `SUPABASE_SERVICE_ROLE_KEY` set as server-side environment variables. Never expose the service-role key with a `NEXT_PUBLIC_` prefix.
3. Deploy the release to the Testnet environment.
4. From two authenticated test users, open each user's server-issued GreenHaven ID and attribute a referral using the second user's ID.
5. Confirm a valid canonical ID is accepted, an unknown well-formed ID is rejected as not found, malformed input is rejected as invalid, self-referral is rejected, and duplicate attribution remains one-time/idempotent per the existing referral contract.
6. Test transfer recipient resolution separately; referral success must not be treated as proof that GHC transfer settlement works.

## Remaining work

Profile names and avatars across feeds, comments, discovery, member lists, and referral cards are Phase 3. Phase 2 does not invent profile details or rewrite users' existing IDs. Legacy IDs that were only generated in a browser cache and never registered in the durable directory need an explicit, reviewed reconciliation path; they must not be guessed into another user's account.
