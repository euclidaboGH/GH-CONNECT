# GreenHaven 0.281.0 — Phase 4 Discover & Communities Depth

Date: 2026-11-03

## Goal

Match cards and communities feel intentional: clear CTAs, honest empty states, privacy-aware join, no stuck loading.

## Discover
- Photo cards remain default; toggle label shows the *other* mode.
- Follow success: toast + `ghc:discover-soft-revalidate`.
- Connection request success: soft-revalidate.
- List header: ranked matches copy.

## Communities
- Directory load hard-timeout 15s (loading cannot stick forever).
- Discover empty: Clear filters / Retry directory secondary actions.
- GroupCard `joinLabel`: Join vs Request to join from privacy.
- Join gate privacy hint retained.
- Create modal validation retained (name ≥3, description rules).

## Verification
`node scripts/check-phase4-discover-communities.mjs`
