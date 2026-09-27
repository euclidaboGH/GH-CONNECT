# GH Wallet — GHC Withdrawal & Pi Settlement

**Status:** Implemented (source verified; Testnet/operator E2E pending)
**Product:** GreenHaven  
**Depends on:** Durable GHC ledger, authenticated session, operator/admin controls  
**Does not depend on:** Phase 2+ social economy, Pi Ads rewards, client-minted balances  

**Explicitly out of scope for this document’s implementation phase:** coding, migrations, auto-payout bots, A2U blockchain automation (may be a later operator tool, not required for v1 manual settlement).

---

## 1. Purpose (plain language)

Users earn or hold **GHC** (GreenHaven Coin) as an **in-app utility balance**.

When they have enough **withdrawable** GHC to equal **at least 100 Pi** at GreenHaven’s approved rate, they can:

1. Open **Withdraw GHC**
2. Confirm their **Pi Network wallet address**
3. Submit a **withdrawal request**
4. Wait while GreenHaven **reviews and sends Pi** from the platform side
5. See the request marked **Completed** (or **Rejected** / **Failed**)

The user is **not** transferring Pi themselves inside the app.  
The app creates a **request**. **GreenHaven (operator)** pays Pi and settles GHC on the server.

---

## 2. Core concepts (do not collapse these)

| Bucket | Meaning | User can spend in-app? | User can withdraw? |
|--------|---------|------------------------|--------------------|
| **Total GHC** | All ledger balance | — | — |
| **Locked GHC** | Held for escrow, disputes, pending withdrawals, policy holds | No | No |
| **Available GHC** | Usable for in-app utility (tips later, fees, catalog, etc. per product rules) | Yes (per rules) | No (until classified withdrawable) |
| **Withdrawable GHC** | Subset of balance explicitly eligible for Pi settlement | Prefer no double-spend | **Yes** (subject to minimum) |

**Rule:** Not every GHC from social activity is automatically withdrawable.  
Eligibility is a **server policy**, not a client claim.

Suggested invariant:

```text
Locked + Available + Withdrawable accounting ≤ authoritative ledger balance
(exact partitioning defined by ledger entry types / flags)
```

---

## 3. Eligibility

### 3.1 Minimum withdrawal

- **Minimum:** equivalent of **100 Pi** at the **conversion rate frozen at request creation**.
- If withdrawable GHC × rate &lt; 100 Pi → button disabled / clear message:  
  **“Minimum withdrawal is 100 Pi equivalent.”**

### 3.2 Who may request

- Authenticated GreenHaven user (server session).
- Account not banned / not under withdrawal freeze.
- Optional (recommended): account age, verification, or membership rules — product decision, server-enforced.

### 3.3 What cannot be withdrawn

- Locked GHC  
- Pending withdrawal amounts already reserved  
- Non-withdrawable reward buckets (if product marks engagement rewards as non-cashable)

---

## 4. Conversion rate

**Canonical server rate:** `REFERENCE_GHC_PER_PI` in `lib/server/economy/economic-config.ts` (default **100 GHC per 1 π**). This is **not** 1 GHC = 1 π.

Cross-check: VIP membership is **150 GHC** and **1.5 π** in GH Pay → same 100:1 reference.

**Minimum withdrawal:** 100 π equivalent → **10,000 GHC** at the default rate.


- GreenHaven maintains an **approved GHC→Pi rate** (operator-configured, server-only).
- **At request creation**, store:
  - `ghcAmount`
  - `rateUsed` (immutable for that request)
  - `piAmount` = f(ghcAmount, rateUsed) rounded per published rules
- User must see **before confirm**:
  - GHC to withdraw  
  - Rate used  
  - Pi they will receive  
  - Minimum check result  

**Forbidden:**

- Client-supplied rate  
- Client-supplied Pi amount as authority  
- Silent rate change after request is created  

---

## 5. Pi wallet address

### 5.1 Save address

UI allows:

- **Pi Network wallet address** field  
- **Save wallet address** (profile/wallet settings)

### 5.2 Safety

- Before each withdrawal, **re-show and require confirm** of destination (do not silently use a stale address without confirmation).
- Changing the saved address requires explicit user confirmation.
- Once a request is **Processing** or later, **destination is immutable**.

### 5.3 Validation (product + technical)

- Non-empty, length/format checks as GreenHaven defines for Pi addresses.
- Optional: warn on lookalike / first-time address.

---

## 6. Withdrawal lifecycle

| Status | Meaning | GHC effect |
|--------|---------|------------|
| **Requested** | User submitted; awaiting review | Reserved (Withdrawal Pending) |
| **Under Review** | Operator examining | Still reserved |
| **Approved** | Operator accepted; payout queued | Still reserved |
| **Processing** | Pi transfer in progress | Still reserved |
| **Completed** | Pi sent and recorded | Reserved amount **settled** (permanently deducted from withdrawable) |
| **Rejected** | Denied by policy/operator | Reserved amount **returned** to withdrawable/available per rules |
| **Failed** | Transfer attempt failed | Reserved amount **returned**; may retry under new request |

Transitions are **server-only**. Client cannot set Completed/Approved.

---

## 7. Balance protection (ledger rules)

1. On **Requested**: move `ghcAmount` from **Withdrawable** → **Withdrawal Pending** (lock).  
2. Pending amount **cannot** be spent or requested again.  
3. On **Completed**: finalize deduction; write immutable settlement record with operator reference.  
4. On **Rejected** / **Failed**: release lock back to withdrawable (or policy destination).  
5. **Idempotency:** unique `withdrawalRef` per request; double-complete impossible.  
6. **No client** can create a Completed withdrawal or credit Pi.

---

## 8. User interface (Wallet)

### 8.1 Summary

- Available GHC  
- Withdrawable GHC  
- Approx. Pi value of withdrawable balance  
- Minimum withdrawal (100 Pi equivalent)  
- Primary CTA: **Withdraw GHC** (enabled only when eligible)

### 8.2 Withdraw flow

1. Tap **Withdraw GHC**  
2. Enter/confirm amount (or “max withdrawable”)  
3. Show GHC, rate, Pi payable, fees if any  
4. Confirm Pi wallet address  
5. Confirm request  
6. Success → request id + status **Requested**

### 8.3 Withdrawal history

List with status badges:

- Pending / Under Review / Approved / Processing / Completed / Rejected / Failed  

Detail screen: amounts, rate, destination (masked if needed), timestamps, operator reference when completed.

---

## 9. Operator / admin side

Operators (privileged, audited roles only):

1. View queue of requests  
2. Verify user, amount, destination, fraud signals  
3. Approve or reject with reason  
4. Process Pi transfer **out of band** (manual or approved tooling)  
5. Enter **transaction reference** / proof  
6. Mark **Completed** only after confirmation  

**Separation of duties (recommended):** requester ≠ sole approver for high amounts; all actions audit-logged.

---

## 10. Security & fraud

| Control | Requirement |
|---------|-------------|
| Authentication | Session-derived user id only |
| Authorization | Only owner creates request; only ops settle |
| Rate | Server-side only |
| Double spend | Pending lock + unique ref |
| Destination | Confirm every time; freeze after processing |
| Enumeration | No leaking other users’ withdrawals |
| Client trust | Never trust client balances or “paid” flags |

---

## 11. Relationship to A2U / automation

- **v1:** Manual or semi-manual operator Pi payout is acceptable and clearer.  
- **Later:** Optional automation (e.g. A2U) only if secure keys, limits, and dual control exist.  
- Spec does **not** require enabling A2U to ship withdrawal **requests**.

---

## 12. Relationship to GH Social Economy

- Social Phase 1 (reactions, follow, etc.) does **not** make GHC withdrawable.  
- Creator / engagement rewards may be **non-withdrawable** until policy says otherwise.  
- Level 7 (Haven) is a **program gate** in social-economy docs; withdrawal eligibility is a **separate** wallet policy (may later require Haven+, but not by default in this spec).

---

## 13. Acceptance criteria (when implemented later)

1. User below 100 Pi equivalent cannot submit.  
2. Eligible user creates request; balance shows pending lock.  
3. Refresh shows same request and reduced withdrawable balance.  
4. Client cannot mark Completed.  
5. Reject/fail restores reserved GHC.  
6. Complete settles once; second complete is no-op/error.  
7. Operator audit trail exists for approve/complete.

---

## 14. Implementation readiness (future work — not now)

Suggested build order when coding is approved:

1. Ledger types: reserve / release / settle withdrawal  
2. Tables/RPCs: withdrawal requests + RLS/service-role  
3. User API: create request, list mine, get one  
4. Operator API: review, complete, reject  
5. Wallet UI: withdraw CTA, form, history  
6. Tests: eligibility, lock, double-complete, IDOR  

**Do not start this coding while Phase 1 runtime E2E is still pending unless product prioritizes wallet over social verification.**

---

## 15. One-line summary for stakeholders

> Users request Pi cash-out of eligible GHC above 100 Pi equivalent; GreenHaven locks GHC, pays Pi from the platform to the user’s confirmed Pi address, then settles the ledger—never from the phone alone.
