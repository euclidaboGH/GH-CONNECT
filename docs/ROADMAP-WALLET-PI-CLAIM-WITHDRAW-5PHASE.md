> **LEGACY VERIFICATION FIXTURE — NOT CURRENT PRODUCT AUTHORITY.**
> This document is retained only because an executable regression/operator check references it. For current implementation decisions, follow `docs/SOURCE_OF_TRUTH.md` and executable source. Do not resurrect historical behavior from this file.

# Roadmap — Wallet, registration top-up, PI claim & withdraw (5 phases)

## Goal
Legacy **0.05 π** claimants complete **3 π** total via **2.95 π** top-up. New users claim **3 π**. Users withdraw available PI to their **KYC’d Pi wallet** linked at Pi sign-in. Wallet UI stays dual-asset and professional.

> Amount note: **3 − 0.05 = 2.95 π** (not 2.85). Policy constants use **2.95**.

---

### Phase 1 — Legacy registration top-up (ledger authority)
- Policy: full **3 π** (`registration_bonus:v2:{userId}`) or top-up **2.95 π** (`registration_bonus:v2_topup:{userId}`).
- Client never chooses amount; claim RPC is service_role / server-only.
- **Operator must apply** `20261030010001_registration_bonus_v2_reconciliation.sql`.
- Env: `GHC_REGISTRATION_BONUS_ENABLED=1`, `NEXT_PUBLIC_PI_SANDBOX=true`, `PI_NETWORK=testnet`.
- Optional Testnet backfill: `scripts/ops/phase2-registration-bonus-backfill-testnet.sql` (preview first).
- UI: claimable legacy users see **Claim remaining 2.95 π** on Wallet.

**Done when:** Legacy ledger shows 0.05 + 2.95 = **3 π**; new claims post 3 π once.

> **Status (source):** Complete in 0.208+ / Phase 5 gate.

---

### Phase 2 — Professional dual-asset wallet
- One card: selectable **PI** and **GHC** rows with balances.
- Shared **Send · Request · Receive · History**.
- Rails never mixed; advanced recovery/sandbox under accordion.
- Month metrics + fail-closed PI snapshot.

**Done when:** Wallet no longer stacks duplicate PI dashboards as primary chrome.

> **Status (source):** Complete in 0.209+ / Phase 5 gate.

---

### Phase 3 — PI claiming buttons
- Registration bonus card on Wallet (and Rewards compact path).
- Full-width claim CTA for legacy reconciliation.
- Events `ghc:earnings-refresh` / `ghc:wallet-refresh` after claim.

**Done when:** Claimable users can complete 3 π without operator SQL per user (RPC path).

> **Status (source):** Complete in 0.210+ / Phase 5 gate.

---

### Phase 4 — PI withdrawal to KYC’d linked Pi wallet
- Quote: 3% fee, net to linked `gh_pi_identities` recipient (never body-controlled).
- **Withdraw to Pi wallet** creates durable payout request (`PI_EARNINGS_PAYOUT_REQUESTS_ENABLED=true` + `PI_NETWORK=testnet`).
- A2U **execution** remains server worker (`/withdrawals/execute` + executor key) — Testnet-only, funded, receipt-verified.
- Eligibility: min payout, linked identity, authorization, available balance.

**Done when:** Eligible Testnet user requests payout → request reserved → worker completes A2U → ledger paid; no client-invented success.

> **Status (source):** Complete in 0.211+ / Phase 5 gate. Live A2U still operator-gated.

---

### Phase 5 — Integration, gates, release
- Static contracts: registration-bonus, unified-wallet-card, phase20, release hygiene, project truth.
- Operator checklist: migration applied, flags set, backfill preview, A2U funding, min payout understood.
- Package integrity; no Mainnet A2U enablement by default.

---

## Operator checklist (Testnet)
1. Apply migration `20261030010001_registration_bonus_v2_reconciliation.sql`.
2. Set env flags (bonus + sandbox + network).
3. Redeploy.
4. Legacy user: Wallet → Claim remaining 2.95 π **or** run backfill SQL after preview.
5. Confirm withdrawable ≥ min payout before enabling `PI_EARNINGS_PAYOUT_REQUESTS_ENABLED`.
6. Fund A2U and run executor only after identity/authorization checks pass.


---

## Phase 5 status
Source release gate documents and static contracts package Phases 1–4.
See `docs/PHASE5_WALLET_RELEASE_GATE.md` and `docs/OPERATOR_CHECKLIST_WALLET_PI_5PHASE.md`.
