# GreenHaven Phase 3 — referral identity and navigation repair

## Source changes

- GreenHaven ID resolution now probes known legacy public-ID columns independently. Previously, one missing column inside a PostgREST `or` filter could make the entire query fail, returning “ID not found” even if another column existed.
- Resolution returns only the canonical `gh_profiles.user_id`. It deliberately does not fall back to a profile row's `id`, which can be a different identifier and could attribute a referral to the wrong account.
- Referral-attributed local notification now opens the profile surface rather than forcing navigation to Rewards.

## Required operator verification

1. Confirm which public-ID column is canonical in the deployed Supabase schema; add it to the candidate list if different.
2. Test a valid GreenHaven ID, invalid ID, self-referral, already-attributed account, and referral code.
3. Confirm referral attribution is committed by `ghc_referral_attribute`, remains immutable, and is persisted server-side.
4. Verify invite URL capture survives sign-in/signup and does not allow self-referrals or code changes after attribution.
5. Run the project's supported Node.js 24 CI build before deployment.

## Safety

This change does not mint referral rewards, bypass the referral RPC, infer user IDs from profile IDs, or claim that live database schema and deployment have been verified.
