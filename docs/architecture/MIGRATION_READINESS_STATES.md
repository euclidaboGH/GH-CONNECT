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
