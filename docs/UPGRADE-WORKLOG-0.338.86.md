# UPGRADE-WORKLOG 0.338.86 — Run #302 Pi A2U safety correction

Authoritative input: `GREENHAVEN-0.338.85-RUN302-V3-PI-WALLET-SCOPE-A2U-FIX.zip`.
Package: `gh-connect@0.338.86`.
Scope: source-only correction plus the explicitly requested Testnet migration. Mainnet, GitHub and Vercel were not changed.

## Implemented and verified

1. Reviewed the Run #302 wallet-scope consent and A2U withdrawal flow from the supplied archive.
2. Restricted historical wallet-scope backfill to explicit user consent, recognized wallet address source and a valid Pi address.
3. Added null-safe validation for wallet address source values.
4. Hardened provider destination adoption to verify the current Pi identity mapping and exact payout request.
5. Required the exact provider payment ID already bound to the payout request.
6. Required Pi Testnet network and an eligible in-progress payout status before destination adoption.
7. Added a strict five-argument service-role RPC and a service-role-only compatibility overload for the currently deployed worker.
8. Updated the withdrawal worker to pass the provider payment ID into the strict RPC.
9. Updated package, lockfile, in-app release identity, migration inventory, manifest, checklist, source-truth and release notes to 0.338.86.
10. Applied migration `20261116045934_pi_wallet_scope_consent_provider_address_discovery` to Supabase Testnet after confirming prerequisite `20261110125500`.
11. Verified the migration history, new column, both RPC overloads and execute privileges: service_role=true; anon=false; authenticated=false.
12. Verified that no historical authorization was auto-promoted, all 13 released payout rows remained without provider payment IDs/txids, and there were zero active payout requests at verification time.

## Verification limits

- Run #302 static hardening checks: 35/35 pass.
- Run #300 release integrity: 20/20 pass.
- Run #301 release gate: 20/20 pass after metadata synchronization.
- Migration inventory: 224 files synchronized; SQL lexical integrity passed.
- Release hygiene: 17/17 pass; dependency-lock integrity passed.
- Source-only verification scope: these checks do not prove live Pi Testnet A2U transfer success.
- Required runtime for full dependency-backed checks: Node.js 24.15.0. The available runtime in this workspace was Node.js 22.16.0 and dependencies were not installed, so full typecheck, lint and production build are not claimed.
- Live Pi Testnet A2U transfer, Pi Developer Portal permission confirmation, deployed Preview/browser/device verification and Mainnet approval remain outstanding. Production remains NOT APPROVED.
