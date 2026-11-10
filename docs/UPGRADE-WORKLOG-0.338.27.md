# GreenHaven 0.338.27 — Run 261 worklog

## Delivered in source

- Added a restricted operator page at `/admin/a2u-qualification`.
- Added authenticated + `GHC_A2U_ADMIN_KEY` protected qualification API.
- Added explicit fully-KYC-passed Pioneer attestation bound to the durable GreenHaven Pi UID mapping.
- Added read-only Pi provider `getPayment` verification for existing Testnet A2U payments.
- Requires app-to-user direction, Pi Testnet network, exact recipient UID, positive amount, matching verified txid, developer completion, non-cancelled state and GreenHaven A2U request metadata.
- Added durable qualification tables with RLS, no client access, service-role-only RPCs, unique provider payment ID, unique txid and one qualifying transaction per distinct recipient UID.
- Added progress register and operator evidence display.
- Added migration `20261110210001_pi_a2u_ecosystem_qualification.sql`, classified `REVIEW_REQUIRED`.

This release has **source-only verification** at this stage; the external runtime and provider gates below remain open.

## Explicit limitations

- The Pi KYC status is not fetched from a machine-readable KYC endpoint. An authorized operator must verify fully passed KYC in the official Pi KYC app and attest using a non-sensitive evidence reference. Tentative KYC is excluded.
- The qualification API does not create, submit, complete, cancel or retry payments. Existing GreenHaven A2U workflows remain the only execution path.
- Five distinct recipients are required. A repeat payment to an already counted recipient cannot increase the qualification count.
- No actual A2U payment is counted by source code or by an operator's manual assertion alone; the Pi provider record and verified transaction must pass server checks.
- No migration has been applied, no Vercel deployment or GitHub push was performed, and no Pi payment was initiated. Mainnet remains untouched.

## Verification plan

Run `node scripts/check-run261-a2u-ecosystem-qualification.mjs`, `node scripts/check-run260-pi-wallet-address-and-a2u-diagnostics.mjs`, `node scripts/check-migration-source-manifest.mjs`, and `node scripts/check-sql-lexical-integrity.mjs`. A dependency-backed typecheck, lint, build, PostgreSQL execution, and live Testnet verification are separate gates requiring the project's Node 24.15.0 runtime, dependencies, and Testnet operator setup.
