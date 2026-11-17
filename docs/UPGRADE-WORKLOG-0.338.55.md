# GreenHaven 0.338.55 — Mobile Content Recovery & Wallet Reconciliation Audit

## Scope
- Preserve the RUN291 / 0.338.54 source baseline and domain architecture.
- Reduce mobile header and introductory-panel occupation in Marketplace, Communities, Discovery and Messages.
- Re-audit the Testnet payout authorization and recovery schema before touching financial state.

## Implemented in source (source-only; no deployment or live schema changes)
- Added a mobile-only composition pass in `app/globals.css` for compact Marketplace toolbar/header rows, Community collapsing-header spacing, Discovery introductory/outcome panels, and Messages relationship summary.
- Kept all controls present and retained touch-target minimums where practical; no wallet, payment, membership or identity domain logic was changed.
- Bumped package version to `0.338.55`.

## Live Testnet findings
- `public.gh_pi_wallet_authorization_confirm_provider_address(text,text,text,text)` is absent from the live database (`to_regprocedure` returned NULL).
- Migration history currently ends at `20261111114429` in the inspected range. The source migration `20261110125500_pi_wallet_address_binding_and_verified_a2u_diagnostics.sql` is not recorded in live migration history.
- This migration adds wallet-address binding columns and multiple payout RPC definitions, not just the missing function. Applying it alone without reconciling all intervening migrations is unsafe; no migration was applied.
- The three uncertain payout requests remain reserved. No provider payment ID or txid is persisted for the aggregate of three requests. No balance was changed.
- The current provider adapter only exposes Pi's incomplete server-payment lookup. That is not authoritative complete payment history and cannot prove that an unlisted payment never existed. No blind release or replacement payment is permitted.

## Outstanding blockers
- Reconcile the full source migration sequence with live Testnet history before applying the wallet-address-binding migration and later dependent migrations.
- Build an operator-only provider reconciliation path only after verifying supported Pi Platform API capabilities and obtaining exact provider evidence for each request.
- Capture a correlated Vercel request trace for the HTTP 403 to distinguish executor-secret rejection from Supabase REST/RPC permission denial.
- Run Node 24.15.0+ dependency-backed lint/typecheck/build and mobile E2E; current local runtime is Node 22.16.0, below repository requirement.

## Safety
- No live schema changes, financial ledger changes, A2U payment submissions, or production deployments were made.
