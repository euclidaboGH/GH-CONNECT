# RUN373 — Phase 1–2 remediation and continuation

**Date:** 2026-11-19  
**Baseline:** `GREENHAVEN-0_338_101-RUN372-FIELD-RESEARCH-DISCONNECTED-2026-11-19.zip`  
**Package:** `gh-connect@0.338.102`  
**Scope:** Apply a narrowly supported Pi sign-in UX improvement, preserve security boundaries, and record Phase 2 operator-only database follow-up without altering live migration history.

## Implemented

1. Improved `humanizePiAuthError()` for the observed generic `Authentication failed.` rejection. In a recognized Pi Sandbox iframe, the sign-in screen now explains that the SDK rejected before GreenHaven received an access token and gives concrete checks: Testnet app registration, exact hosted URL, Pi Utilities Sandbox authorization, and reopening from Pi → Develop.
2. Added a separate in-Pi non-Sandbox message for the same generic rejection. It does not incorrectly blame GreenHaven identity/session storage because the server auth route was not reached in the observed failure.
3. Added `scripts/check-run373-pi-auth-actionable-rejection.mjs` and registered it at the start of `prebuild:checks`, `verify:static`, `pretypecheck`, and `prelint`.
4. Incremented package and lockfile root versions to `0.338.102`. No dependency versions or package integrity records were changed.

## Security invariants preserved

- Pi sign-in still requests `username` only; it does not silently request `payments` or `wallet_address`.
- The server still verifies the Pi access token through Platform API `/v2/me` before creating a GreenHaven identity/session.
- No local or memory-backed production identity fallback was added.
- No token, UID, username, cookie, or raw SDK error is added to diagnostics.
- GHC ledger, reward issuance, payment, payout, and membership behavior is untouched.

## Phase 2 database follow-up — not applied

The read-only Testnet audit found that `gh_pi_identities` and `gh_sessions` have deny-all RLS policies, but their ACLs still grant client-role `SELECT`. Application references are server-side and use the service-role credential. A defense-in-depth `REVOKE SELECT ON public.gh_pi_identities, public.gh_sessions FROM PUBLIC, anon, authenticated` is therefore a reasonable additive hardening change, provided a postflight check confirms `service_role` retains required access.

A review-only proposal is prepared at `supabase/proposals/20261119_revoke_client_select_identity_session_tables_review.sql`, including postflight checks that client SELECT is absent and `service_role` SELECT remains. RUN375 validates its isolation (11/11). This change is deliberately **not** applied or added to the ordered migration history in this pass:

- The Supabase CLI is not available in the execution environment, and the required `supabase migration new` workflow could not be completed.
- Testnet migration history is materially drifted from the local 231-file source inventory. No migration replay, repair, `db push`, or direct SQL schema mutation is safe until the exact remote/local mapping is reconciled.
- Mainnet has no application schema and remains untouched.

## Pi authentication root-cause boundary

The observed failure still occurs inside `Pi.authenticate()` in the Sandbox frame. No access token is returned and no `/api/auth/pi` request reaches the server. The code cannot safely fix a Pi Portal registration, hosted URL, Sandbox authorization, or Pi Browser host rejection. The new UX directs the operator to verify those external conditions; it does not pretend the external root cause has been repaired.

## Verification status

- RUN373 targeted gate: 8/8 PASS.
- Existing RUN338/RUN342/RUN344/RUN370/RUN371 Pi auth gates: 25/25, 6/6, 10/10, 7/7 and 9/9 PASS.
- Full static suite, Node 24 typecheck/lint/build, live Pi Browser sign-in, and two-account E2E remain separate gates.
- No Supabase writes, migration application, GitHub push, Vercel deployment, Mainnet operation, or financial operation was performed.

**Release decision remains: NOT APPROVED.**
