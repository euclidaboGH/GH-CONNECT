# GH-CONNECT Phase 9 — Mainnet Readiness Snapshot

**Decision: READY WITH OPERATOR GATES**

Code/static/security gates pass. Live multi-user Testnet proof and Production environment attestation remain operator-owned. This is **not** authorization to deploy Mainnet.

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
