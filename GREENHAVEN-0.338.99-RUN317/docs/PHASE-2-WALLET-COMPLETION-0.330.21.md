# Phase 2 — Wallet completion increment (0.330.21)

## Implemented

- Extended GHC transaction receipts with allowlisted existing correlation metadata: order, reward, request, payment-intent, correlation and provider-payment identifiers. Values are bounded and control-character filtered; missing references remain absent rather than fabricated.
- Added a shared transaction search field to the full-history surface. It searches GHC IDs/references/descriptions/source events and Pi intent/reference/provider IDs/purpose/product/status. Asset rails remain separate and use their existing transaction detail views. Selecting Pi history activates the existing authenticated, read-only Pi history loader.
- Reworked month-to-date GHC insight aggregation: only posted ledger movements count as settled incoming/outgoing, pending is separately reported, request-only rows are excluded, and failed/reversed/cancelled/expired rows are excluded. Scope remains the currently hydrated GHC ledger rows, not a complete lifetime statement.
- Preserved existing GHC Send, Request, Receive and withdrawal panel flows and the dedicated Pi withdrawal consent sheet. No new payment execution path was created.

## Verification

A new 12-contract source regression gate is registered in `prebuild` and `verify:static`. It checks shared cross-rail search, receipt references, separate asset rails, financial insight semantics and preservation of canonical action journeys.

## Not certified

No physical low-end Android device, Android WebView or Pi Browser is available in this execution environment. Responsive behavior is reviewed at source level only. Node 24.15.x TypeScript, ESLint and production build are also outstanding because the available runtime is Node 22.16.0 and dependencies are not installed. Live Supabase/RLS and Pi Testnet acceptance remain required. No database migrations or financial authority changes were made. Production remains NOT APPROVED.
