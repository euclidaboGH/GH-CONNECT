# Deployment guide — GH-CONNECT 0.330.6

## 1. Artifact

- Archive: `GH-CONNECT-0.330.6-PHASE5-GLOBAL-PRODUCTION-READINESS.zip`
- Version: `0.330.6`
- Canonical migrations: **189** (none added in Phase 5)

## 2. GitHub

1. Extract the ZIP into a clean working tree (or replace the repo contents carefully).
2. Commit on a release branch; open PR to `main`.
3. Ensure branch protection requires the **CI** workflow (`.github/workflows/ci.yml`) to pass.
4. Do **not** commit `.env`, service-role keys, or Pi platform secrets.

## 3. Vercel

1. Project settings: Framework **Next.js**, Install `npm ci --legacy-peer-deps`, Build `npm run build` (matches `vercel.json`).
2. Environment variables (names only — values are operator secrets):

   **Public**

   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_PI_SANDBOX` (`true` for Testnet)
   - Other `NEXT_PUBLIC_*` as already documented in `.env.example`

   **Server-only (never NEXT_PUBLIC_)**

   - `SUPABASE_SERVICE_ROLE_KEY`
   - Pi platform API keys / app credentials used by server payment verification
   - Any payout worker / A2U enable flags as already defined in operator economy docs

3. Deploy **Preview** first. Confirm health and wallet sheet open/close without navigation kick-out.
4. Promote to Production only with explicit operator approval.

## 4. Supabase

1. Apply migrations in the order of `MIGRATION-SOURCE-MANIFEST.csv` / `TESTNET_APPLY_ORDER.md` if present.
2. Phase 5 adds **no** new SQL. If 189 files are already applied, do nothing.
3. Confirm RLS remains enabled on user-owned tables.
4. Never paste service-role keys into client bundles or public repos.

## 5. Pi Network

1. Keep **sandbox / Testnet** until operator signs off Mainnet.
2. Withdrawal requests may be accepted by the app API; **settlement** requires server worker + funding + flags.
3. Consent must go through genuine Pi authentication paths already implemented in `lib/client/pi-wallet-consent.ts`.

## 6. Post-deploy smoke (Preview)

1. Sign in with Pi (sandbox).
2. Open Wallet → Pi rail → **Withdraw** once.
3. Type amount and PIN fields — sheet must stay open; values must not clear.
4. Confirm only one primary Withdraw CTA on the wallet surface.
5. Settings → account export / lifecycle requests (if UI wired) return authorised responses, not 500s.
6. Feed / messaging media still resolve via facade or signed URL.

## 7. Rollback

Redeploy `0.330.5` artifact. Database is unchanged by Phase 5 application code.

