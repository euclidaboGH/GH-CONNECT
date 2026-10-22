# GreenHaven live Testnet release gates

This runbook is intentionally read-only until the operator explicitly applies a reviewed migration. A passing static test does not establish live database state.

## 0. Safety boundary

- Run only against the Vercel **Preview** URL and the dedicated Testnet Supabase project first.
- Do not set `GHC_E2E_ALLOW_PRODUCTION=1` for this runbook.
- Never paste service-role keys, Pi API secrets, wallet seeds, JWT secrets, session cookies, or auth headers into Git, issue trackers, or chat.
- Do not apply all files in `supabase/migrations` blindly. Reconcile both projects' migration history separately.

## 1. Establish the actual deployment target

In the Vercel Preview deployment, verify `VERCEL_ENV=preview`, `NEXT_PUBLIC_PI_SANDBOX=true`, the Testnet Pi client/server credentials, the Testnet domain-validation key, and the Testnet Supabase URL/service-role key. Verify Production independently and ensure it uses Mainnet credentials and a different Supabase project. The values must come from the deployment's environment settings, not this template.

Run the public readiness probe against Preview:

```sh
GHC_E2E_BASE_URL=https://gh-connect-5p3o.vercel.app npm run operator:live-e2e
```

A health `503` is not a successful release gate; it can be a useful diagnostic while schema/configuration is incomplete. Inspect the readiness JSON without publishing secrets. This smoke test is partial unless authenticated A/B test credentials are provided securely in the local shell.

## 2. Reconcile migrations before applying anything

From a trusted workstation with Supabase CLI authenticated to the correct organization, inspect remote migration history for each project separately. Use the project ref explicitly and verify it against the Supabase dashboard before running commands.

```sh
npx supabase migration list --project-ref "$TESTNET_PROJECT_REF"
node scripts/check-migration-release-readiness.mjs
node scripts/print-migration-checklist.mjs
```

If the project is linked locally, confirm the linked ref before any `db push`. Do not use `db push` until the reviewed diff is understood. The self-curation sequence is intentionally superseding: `20261022010074_curation_self_vote_guard.sql` precedes `20261022010075_allow_self_curation.sql`; the later function permits self-curation for display but excludes self-votes from independent reviewer evidence, account reputation, and GHC rewards. Future-dated migrations need explicit dependency review and a recorded release decision; filename chronology is not proof of application.

Use a disposable database to replay the selected migrations from a clean state first. Capture the migration list before and after Testnet application. Do not change Mainnet during Testnet validation.

## 3. Authenticated multi-account security checks

Use two dedicated Testnet accounts with separate browser sessions. Do not use real users' credentials. Run the existing operator suite with local shell variables that are not saved to files:

```sh
GHC_E2E_BASE_URL=https://gh-connect-5p3o.vercel.app \
GHC_E2E_COOKIE_A="$TESTNET_COOKIE_A" \
GHC_E2E_COOKIE_B="$TESTNET_COOKIE_B" \
npm run operator:live-e2e
```

Verify both sessions resolve to distinct user IDs and cannot read or mutate each other's private profile, inbox, messages, saved items, or wallet state. Expand coverage with these manual/automated cases before sign-off:

- replay the same Pi payment callback and confirm one fulfilment only;
- attempt approval/completion with a mismatched payer, payment ID, amount, product, or network;
- submit duplicate/replayed curation events and concurrent votes;
- self-curate a post and verify it cannot qualify as independent settlement evidence or earn account reputation/GHC;
- attempt reciprocal curation rings and repeated social actions; confirm caps and risk review without irreversible automatic punishment;
- submit fabricated watch-time/ad-completion events and verify they are rejected unless provider/server-confirmed;
- test daily caps across UTC/local-day boundaries and concurrent requests;
- verify unauthorized RPC execution is denied to `anon` and `authenticated`.

## 4. Reputation and abuse pipeline gates

The 80/20 quality/social policy is a target until the authoritative server pipeline computes it from validated evidence. Quality/reputable system activity is the 80% target; eligible social interaction is capped at 20%. Do not count raw likes/upvotes, self-curation, wallet balance, client-submitted ranks, repeated comments, background tabs, or unverified ad/video events as authoritative reputation.

The settled-curation-to-account-reputation bridge remains disabled until all of the following exist and pass tests:

1. an append-only compensating-event model for reversals/corrections;
2. atomic settlement + reputation event insertion;
3. minimum confidence of 75 and at least five distinct eligible reviewers;
4. exclusion of the author and self-curation from independent reviewer evidence;
5. idempotency keyed by content/reviewer/settlement epoch;
6. correction, retry, concurrency, deletion, and replay tests;
7. auditable risk flags, review thresholds, and an appeal process.

Coordinated-account detection should use multiple corroborating signals and trigger rate limits/review, not irreversible penalties from a single weak fingerprint.

## 5. Final release evidence

Attach sanitized evidence to the release record: commit SHA, Node/npm versions, successful `npm ci`, `npm run typecheck`, `npm run lint`, `npm run build`, full static test summary, Testnet deployment URL and build ID, migration list before/after, health/readiness report, two-account test results, and Pi sign-in/payment test transaction IDs. Redact credentials and personal data. Only then consider a separate Mainnet change review.
