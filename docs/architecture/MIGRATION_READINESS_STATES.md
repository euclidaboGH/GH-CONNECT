> **LEGACY VERIFICATION FIXTURE — NOT CURRENT PRODUCT AUTHORITY.**
> This document is retained only because an executable regression/operator check references it. For current implementation decisions, follow `docs/SOURCE_OF_TRUTH.md` and executable source. Do not resurrect historical behavior from this file.

# Migration readiness states

| State | Evidence |
|-------|----------|
| SOURCE EXISTS | File in `supabase/migrations/*.sql` |
| STATICALLY VERIFIED | `check:migration-inventory`, release readiness scripts |
| DATABASE APPLIED | Supabase migration history / operator record for that project |
| RUNTIME VERIFIED | Application RPCs succeed (no `EARNINGS_LEDGER_UNAVAILABLE`) |
| TESTNET VERIFIED | Real Testnet user journey with ledger proof |
| PRODUCTION VERIFIED | Separate Mainnet gate — not implied by Testnet |

Manifest files: `MIGRATION-SOURCE-MANIFEST.csv`, `VERIFIED_MANIFEST.txt`, `docs/PHASE5_WALLET_RELEASE_GATE.md`.
