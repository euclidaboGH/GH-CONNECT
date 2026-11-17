# Phase 3 — Operator live acceptance (required to mark Verified complete)

**Package:** 0.330.50  
**Source baseline:** 0.330.49 Phase 3 wallet/rewards/membership hardening  
**Source contract:** `scripts/check-phase3-wallet-rewards-membership-closeout.mjs` → 43/43  

Static/source checks **do not** complete Phase 3. The four items below must pass on **your** infrastructure before Phase 3 may move to `Verified complete` and Phase 4 may start.

Production remains **NOT APPROVED**. Do not enable Mainnet A2U.

---

## 1. Real concurrent claims and purchases (disposable PostgreSQL)

**Goal:** Prove advisory locks + unique refs prevent double credit under concurrent load.

### Prerequisites
- Disposable Postgres matching production major version + extensions used by GH migrations.
- Apply migration inventory through `20261108110001_phase3_wallet_rewards_membership_concurrency_recovery.sql` **only after** reconciling history (migration is `REVIEW_REQUIRED`).
- Synthetic user IDs only; no production credentials in the drill environment.

### Run
```bash
# From repo root, against disposable DATABASE_URL only:
psql "$DISPOSABLE_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/ops/phase3-disposable-concurrent-claims.sql
```

### Pass criteria
- Parallel registration-bonus / reward-claim attempts for the same user yield **exactly one** successful credit per unique_ref.
- Parallel GHC membership activations for the same tier do **not** double-debit.
- Active VVIP is not downgraded by a concurrent GHC purchase.
- No orphaned `reserved` ledger rows without a matching payout request.

Evidence to attach: SQL output + row counts for unique_ref collisions (must be 0 extras).

---

## 2. Authenticated Pi Testnet payments and provider receipts

**Goal:** End-to-end Testnet payment with durable intent → provider receipt → server binding.

### Prerequisites
- `NEXT_PUBLIC_PI_SANDBOX=true`
- Server Pi API credentials for **Testnet only**
- Authenticated app session with linked Pi identity (UID match)

### Run
1. Complete one **membership** or **marketplace** PI payment in Pi Browser (Testnet).
2. Confirm server payment-intent row: provider=`pi`, currency=`PI`, purpose correct, status completed/fulfilled, txid present.
3. Hit recovery only if the client interrupted: authenticated recovery must **lookup provider before binding**, verify direction/network/UID/amount, require verified txid.

### Pass criteria
- Intent amount matches provider receipt atomic amount.
- Payer UID matches mapped identity.
- Ambiguous provider outcomes stay **retryable**, not marked paid.
- No client-supplied payment ID accepted as proof.

Evidence: redacted intent id, provider payment id, txid, server status timestamps.

---

## 3. Actual Testnet membership entitlement recovery

**Goal:** Interrupted purchase recovers entitlement without double charge.

### Run
1. Start VIP/VVIP purchase; interrupt after provider success if possible (or use recovery route on a completed intent without entitlement).
2. Call authenticated membership status + reconcile (rate-limited).
3. Confirm single active entitlement row for the product; lifecycle history shows grant/recovery event.

### Pass criteria
- Exactly one active entitlement for the paid product.
- Second recovery is idempotent (no second debit / no second grant period stacking incorrectly).
- Expired/inactive rows normalize to Free; paid requires active=true and future finite expiry (comp excepted).

Evidence: entitlement row snapshot (user_id, tier, product_id, expires_at, source) + reconcile response `ok`.

---

## 4. Reconcile the specific **3 π** registration reservation / credit

**Canonical amount:** **3 π = 30_000_000 atomic** (`registration_bonus:v2:{userId}`).  
Legacy path: verified **0.05 π** v1 + **2.95 π** top-up (`registration_bonus:v2_topup:{userId}`).

### Run
```bash
psql "$TARGET_DATABASE_URL" -v ON_ERROR_STOP=1 \
  -v target_user="'YOUR_USER_ID'" \
  -f scripts/ops/phase3-reconcile-3pi-registration-reservation.sql
```

### Pass criteria
- Sum of `registration_bonus:%` credits for that user is **exactly 30_000_000** atomic (3 π), not more.
- No double v2 full claim + full top-up.
- If funds show as **reserved**, matching payout request must explain status; unstarted Testnet reservations may release only under the hardened cancel rules (no provider payment id / txid / lease / attempts).

Evidence: SQL result set attached to the release ticket.

Flags (Testnet only when enabling claims):
```
GHC_REGISTRATION_BONUS_ENABLED=1
NEXT_PUBLIC_PI_SANDBOX=true
```
Disable (`=0`) to pause new claims after verification.

---

## Phase 3 → Phase 4 gate

| Item | Owner | State |
|------|--------|--------|
| Source closeout 43/43 | Engineering | Done (0.330.49+) |
| Migration `20261108110001_…` applied on Testnet after disposable drill | Operator | Pending |
| §1 Concurrent disposable PG | Operator | Pending |
| §2 Pi Testnet payment + receipt | Operator | Pending |
| §3 Membership entitlement recovery | Operator | Pending |
| §4 3 π ledger reconciliation | Operator | Pending |
| Node 24.15.x typecheck/lint/build on CI | Operator | Pending |

Only when §1–§4 pass may Phase 3 be marked **Verified complete** and Phase 4 (Identity & Authentication) start.
