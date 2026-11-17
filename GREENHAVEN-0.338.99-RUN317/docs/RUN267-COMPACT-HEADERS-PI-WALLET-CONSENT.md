# Run #267 — Compact global headers and Pi wallet consent

**Release:** 0.338.29  
**Database changes:** None  
**Deployment:** Not performed

## UI scope

A final shared chrome layer reduces the vertical footprint of Discovery, Community, Marketplace, collapsing app headers and section toolbars. It uses smaller title typography, restrained border/shadow treatment, brighter neutral light surfaces, compact horizontal toolbars, safe-area-aware padding, keyboard focus states and reduced scrollbar clutter without reducing usable touch targets.

## Pi wallet authorization

The explicit wallet-consent action now requests only Pi's `wallet_address` scope. The app-local Pi UID is available without a scope, while the server continues to verify the fresh access token using Pi Platform `/v2/me` and matches the verified UID against both directions of the durable GreenHaven identity mapping. The SDK and Platform adapters normalize the documented snake_case field and defensive camelCase/top-level variants.

The server remains fail-closed: a missing, malformed or conflicting address prevents authorization. No user-entered address, guessed address or browser-side authorization flag is accepted. The error message now explains that the user must grant the wallet-address permission in Pi Browser and review the app's permissions if the prompt does not appear.

## Verification

- Run #267 header and wallet authorization static checks: 12/12.
- Phase 28 wallet-consent static checks: 46/46.
- Phase 28 wallet-consent runtime proof tests: 13/13.
- Run #266 social post experience regression: 14/14.
- Project truth checks: 11/11.
- Migration source manifest: 209/209.
- SQL lexical integrity: 209 migrations passed.

The full Node 24.15.0 dependency-backed typecheck, lint and production build remain outstanding because the available runtime is Node 22.16.0 and the dependency installation is not present in this workspace. Pi Browser Testnet acceptance is still required to prove that the app registration and the user's Pi permission grant return `wallet_address`.

No Supabase migration, live wallet authorization, financial ledger, reservation, payout, Pi transfer or Vercel deployment was performed. Production remains NOT APPROVED.
