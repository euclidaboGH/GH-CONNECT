**Production status:** NOT APPROVED

# Current source increment — 0.338.86 (2026-11-16)

Current status:** **NOT APPROVED**

**Current source version:** `0.338.86`  
**Package identity:** `gh-connect@0.338.86`  
**Prior baseline:** `0.338.84` (feed / home / profile / community / post-card density improvements).

This increment hardens Pi A2U wallet-scope consent and provider destination adoption. Historical scope backfill requires explicit-consent provenance and a valid recognized wallet source. The adoption RPC verifies the current identity mapping, exact provider payment ID, Testnet network and executable payout state. Migration `20261116045934_pi_wallet_scope_consent_provider_address_discovery` is applied to Testnet only; Mainnet is untouched. No payout or ledger rows were changed. CALLS_PRODUCTION_ENABLED and REMOTE_PUSH_PRODUCTION_ENABLED remain fail-closed (require infrastructure + operator review).

**Phase 6 source gate and prior static suites retained.** Full static verification must re-run on supported Node 24.15.0 after deploy. Supported Node engine range is `^24.15.0`; Node.js 24.15.0 dependency-backed TypeScript, lint, and Next.js production build remain required. Source checks do not establish a successful supported-runtime build, real browser acceptance, live database readiness or production readiness; static verification does not establish runtime acceptance.

GHC and Pi pricing/settlement authorities remain separate. The source migration inventory is not evidence of applied migrations. The Testnet schema was updated by the single reviewed Run #302 migration. No payout, ledger, wallet balance, GHC or Pi financial records were changed. Production approval remains pending; production remains **NOT APPROVED**.

Production remains **NOT APPROVED**.

## Canonical navigation contract

Bottom navigation (five items): **Home · Messages · Communities · Cart · Profile**.

Wallet remains an overlay surface and is not a primary bottom-nav destination.

