# GH-CONNECT Phase 9 — Mainnet Readiness Snapshot

**Decision: BLOCKED — required evidence has not been collected**

This snapshot is a checklist, not proof of release readiness. A clean install, TypeScript, lint and production build under the pinned runtime have not been established in this working session. Live multi-user Testnet proof, restore rehearsal, provider reconciliation evidence and Production environment attestation remain outstanding. This is **not** authorization to deploy Mainnet.

## Must complete before Mainnet

1. Execute `docs/ops/PHASE7_LIVE_TESTNET_OPERATOR_PROTOCOL.md` (two users).
2. Confirm Vercel **Preview** → Testnet Supabase + `NEXT_PUBLIC_PI_SANDBOX=true` + Testnet Pi keys.
3. Confirm Vercel **Production** → Mainnet Supabase + `NEXT_PUBLIC_PI_SANDBOX=false` + Mainnet Pi keys.
4. Production: `GHC_ALLOW_DEV_AUTH` unset/false; `GHC_SERVER_MEMORY` not authoritative for ledger.
5. Operator: `npm ci --legacy-peer-deps` && `npm run typecheck` && `npm run build` on clean machine/CI.
6. Optional: two-user messaging IDOR + reconnect smoke on Preview.

## Do not

- Mix Testnet/Mainnet secrets
- Deploy Mainnet without operator evidence
- Enable dev auth on Production
- Claim Mainnet Ready from static tests alone
