# GreenHaven production hardening — 2026-09-11

## Source fixes applied

1. **blockedUsers** (already present) — GHC context exposes merged block list to CommentSheet.
2. **Removed unused `cmdk`** — eliminated `use-sync-external-store@1.7.0` from lockfile (Vercel install timeout).
3. **vercel.json** — `installCommand`: `npm ci --legacy-peer-deps` (deterministic installs).
4. **allowLocalAuthFallback** — production/Vercel/Pi hosts cannot be weakened by `NEXT_PUBLIC_ALLOW_LOCAL_AUTH`.
5. **ghc_wallet_snapshot RPC** — full-ledger balance (not limited to latest 500 rows).
6. **Wallet API** — returns authoritative `snapshot` + top-level `balance`.
7. **Wallet sync after daily claim** — reads `snapshot.balance`.
8. **Pi Platform API** — 15s AbortSignal timeouts on get/approve/complete.

## Operator steps

1. Apply `supabase/migrations/20260911_ghc_wallet_snapshot.sql` on Supabase.
2. Push this tree to GitHub (no `.env` secrets).
3. Vercel Preview deploy; confirm install uses `npm ci --legacy-peer-deps`.
4. Smoke-test: Pi sign-in, returning user, daily GHC claim → wallet, Test-Pi payment.

## Not claimed in this environment

Full `npm ci` / `tsc` / `next build` were not completed in the offline sandbox. Verify on Vercel with Node 24.
