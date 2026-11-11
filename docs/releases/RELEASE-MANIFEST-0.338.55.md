# GreenHaven release manifest — 0.338.55 / Run #292

- Source baseline: Run #291 / 0.338.54 archive, extended in place.
- Package: `gh-connect@0.338.55`.
- Scope: mobile content-first layout refinement for Marketplace, Communities, Discovery and Messages; live Testnet payout-schema audit; release/source truth alignment.
- Financial behavior: unchanged. No reservation release, payout execution, settlement, replacement payment or ledger mutation.
- Database: read-only inspection only. The missing wallet-address confirmation RPC and unrecorded source migration are documented; no migration was applied because the source/live sequence is unreconciled.
- Production: **NOT APPROVED**.
- Remaining gates: Node 24.15.0 dependency-backed typecheck/lint/build, Vercel Preview build, visual Android/Pi Browser acceptance, migration-sequence reconciliation, authoritative Pi provider reconciliation and funded Testnet payout acceptance.
