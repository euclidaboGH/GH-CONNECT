# GreenHaven 0.338.25 — Run #259 release-hygiene repair

## Trigger

The GitHub Actions static-verification job and the Vercel Preview build both ran the 0.338.24 source. The supplied GitHub log shows `scripts/check-release-hygiene.mjs` failing only the `safe .env.example exists` assertion (11/12). The Vercel excerpt ends during prebuild and does not include a separate Next.js compiler error; this missing template is therefore the confirmed build blocker from the available evidence.

## Change

- Added a root `.env.example` containing placeholder-only Supabase and Pi Testnet configuration, plus the server-side PIN proof secret and media bucket setting.
- No real credentials, API keys, private seeds, or user data are included.
- Privileged values remain server-only and are not prefixed with `NEXT_PUBLIC_`.
- Pi A2U and earnings payout execution flags default to `false`; the template explicitly warns operators to reconcile the Pi incomplete-payment lane and verify wallet funding before enabling execution.
- Updated package, lockfile and app release metadata to `0.338.25`.
- Preserved the Run #258 Marketplace RPC repair and all existing source changes.

## Verification scope

This is source-only verification performed without the required Node.js 24.15.0 dependency-backed environment; it does not claim a successful TypeScript, lint, or Next.js production build.

The release-hygiene check passes 13/13; the complete `npm run verify:static` suite exits 0, including the 287-command prebuild manifest preservation, Run #258 Marketplace RPC contract 9/9, and generated migration inventory synchronization. The available runtime is Node.js 22.16.0, below the required Node.js 24.15.0, so dependency-backed typecheck/lint/Next.js build remain unverified. This does not establish a dependency-backed Next.js build, authenticated Vercel Preview behavior, Pi provider reconciliation, or production approval. Those require the GitHub/Vercel deployment and operator acceptance gates.

## Safety

No Supabase migration was applied. No ledger, order, inventory, payment, payout, wallet balance, or Mainnet data was changed. No Pi provider action was performed. Production remains NOT APPROVED.
