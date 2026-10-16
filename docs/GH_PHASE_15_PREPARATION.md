# GreenHaven — Phase 15 preparation (NOT approved for implementation)

**Status:** Planning / candidate selection only.  
**Code implementation of Phase 15:** **Do not start** until:

1. CI gates pass (`npm ci`, typecheck, lint, safety, build)  
2. Testnet REQUIRED migrations applied and smoke-checked  
3. Two-user IDOR completed  
4. Pi Browser / Test-Pi E2E completed  
5. Multi-instance smoke completed  
6. Product explicitly selects **one** Phase 15 track below  

Phase 14 (production hardening) does **not** authorize Phase 15 feature work.

---

## Prerequisite gate checklist

| Gate | Owner | Status |
|------|-------|--------|
| `npm ci --legacy-peer-deps` | Operator / CI | Pending |
| `npm run typecheck` | Operator / CI | Pending |
| `npm run lint` | Operator / CI | Pending |
| `npm run test:safety` | Operator / CI | Pending (passes when env available) |
| `npm run build` | Operator / CI | Pending |
| 51 REQUIRED migrations on Testnet | Operator | Pending |
| 1 REQUIRES_APPROVAL reviewed | Product/Security | Pending |
| 2 PROPOSAL left unapplied unless approved | Operator | Policy |
| Two-user IDOR | Operator | Pending |
| Pi Browser E2E | Operator | Pending |
| Multi-instance concurrency | Operator | Pending |

---

## Candidate tracks (pick exactly one when ready)

### Track A — Curation Power (non-financial)

- Distribution weights from durable curation + attention  
- **No** GHC/Pi minting  
- Server-authoritative only  
- Spec required before schema  

### Track B — Connection-request durability

- Activate `20260905_connection_request_intents.sql` only after approval  
- Wire accept/decline APIs to session actor  
- IDOR matrix mandatory  

### Track C — Messaging durable activation

- Two-user messaging IDOR first  
- Then enable `NEXT_PUBLIC_MESSAGING_DURABLE` on Preview  
- No second messaging system  

### Track D — Creator tip settlement (financial)

- Only via existing payment/ledger authority  
- No parallel balances  
- Explicit settlement state machine + audits  
- Highest risk — separate security review  

### Explicitly rejected without a new phase package

- GHC per like/view  
- Client-minted rewards  
- AI “For You” as Phase 15 default  
- Fake Mainnet readiness  

---

## When Phase 15 may begin

Only after product writes:

> “Phase 15 = Track &lt;A|B|C|D&gt; approved”

and the prerequisite gate checklist is green.

Until then, this file is **preparation only**.
