# 0.338.57 — Priority 3 reserved-funds copy build fix

Vercel prebuild failed at check-priority3-rewards-wallet-pin.mjs:

  Reserved funds copy explains never-started release and uncertain provider execution boundary

Required phrases in features/wallet/wallet-balance.tsx:
- not spendable while a request is unresolved
- never-started request
- missing ID alone is not proof

Self-service release remains limited to never-started Pi Testnet requests with no provider evidence (phase3 closeout 43/43).
Production NOT APPROVED.


## Source-only verification
Source-level only. Node.js 24.15.0 runtime required. Production NOT APPROVED.
