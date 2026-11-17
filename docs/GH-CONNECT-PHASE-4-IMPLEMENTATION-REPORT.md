# GH-CONNECT Phase 4 — Financial Infrastructure (0.330.5)

**Release:** 0.330.5 — Phase 4 Financial Infrastructure (partial / critical path)  
**Baseline SoT:** 0.330.4 Phase 3 Profile & Personal Dashboard  
**Date:** 2026-11-06  
**Scope of this package:** Highest-priority wallet reliability — PI withdrawal form stability, single Withdraw CTA, no mid-entry state wipe.

---

## 1. Executive summary

Phase 4 begins with the defect that blocked trustworthy Testnet A2U UX: entering an amount or withdrawal PIN in the Pi withdraw sheet could leave the user on the homepage (wallet overlay closed / form destroyed).

Root causes addressed in this package:

1. **Form state reset on parent remount / open effect re-entry** — the sheet re-initialised amount and PIN whenever the parent re-rendered with `open=true` (e.g. after balance hydration or wallet key remount).
2. **availablePi forced to `null` on every open effect run** — wallet-screen cleared the snapshot at the start of the hydrate effect, so the sheet briefly saw `maxPi=0` and amount clamping could zero a typed value.
3. **`type="number"` mobile input** — decimal inputs on Android can fire unexpected form/navigation behaviour; switched to controlled `text` + `inputMode="decimal"`.
4. **Duplicate Withdraw CTAs** — wallet rail + compact UnifiedEarningsDashboard both rendered a full-width Withdraw, matching the second video.

This package does **not** claim full Phase 4 acceptance (creator tipping, seller payouts, full ledger reporting). Those remain follow-on workstreams on this baseline.

---

## 2. Original defects discovered (from operator video + code)

| Symptom | Observed | Code path |
|--------|----------|-----------|
| Sheet opens, amount focus → Home | Wallet overlay closed | Parent remount / ScreenBoundary dismiss / form wipe |
| Amount / PIN cleared mid-entry | Form empty after brief “Checking…” | open effect + available nulling |
| Two purple Withdraw buttons | Rail + bottom card | wallet-screen + UnifiedEarningsDashboard compact |
| Available 0.00, Reserved 3.00 | Honest ledger | Server snapshot — no client fabrication |
| “Authorized · not currently eligible” vs “Payouts authorized” | Mixed copy | Eligibility vs consent status — left as-is (server truth) |

---

## 3. Root causes confirmed

1. `PiWithdrawSheet` `useEffect([open])` fully reset form whenever the component mounted with `open===true`, not only on closed→open.
2. `wallet-screen` set `piWithdrawAvailable` / `piWithdrawUser` to `null` at the start of every open hydrate, so `availablePi` prop flickered null → number while the sheet was open.
3. `amountPi = Math.min(n, maxPi || n)` with `maxPi===0` during hydrate effectively allowed UI confusion; combined with resets it felt like a kick-out.
4. Compact earnings dashboard still rendered its own primary Withdraw alongside the rail CTA.

---

## 4. Files modified

| Path | Change |
|------|--------|
| `components/ghc/pi-withdraw-sheet.tsx` | Open-transition guard (`wasOpenRef`); session id for PIN fetch; amount touched ref; no clamp to zero max while typing; text+decimal input; backdrop-only close; stopPropagation on panel |
| `features/wallet/wallet-screen.tsx` | Stop nulling available/username on every open hydrate |
| `components/ghc/unified-earnings-dashboard.tsx` | Hide full-width Withdraw when `compact`; hint to use rail CTA |
| `package.json` | version `0.330.5` |
| `VERIFIED_MANIFEST.txt` | version string sync |
| `docs/GH-CONNECT-PHASE-4-IMPLEMENTATION-REPORT.md` | this report |

---

## 5. Features implemented / improved

- **Stable withdrawal form session** — amount and PIN survive balance hydration and parent re-renders while the sheet stays open.
- **Single authoritative Withdraw path on wallet** — rail primary action + event `ghc:open-pi-withdraw`; compact dashboard no longer duplicates the button.
- **Safer mobile amount entry** — no `type=number` Enter/navigation quirks.
- **Intentional close only** — backdrop / explicit X; pointer events on the panel do not dismiss.

Unchanged and preserved:

- Server-authoritative quote and withdrawal (`/api/economy/earnings/quote`, `/api/economy/earnings/withdrawals`).
- PIN set/verify via `/api/identity/withdrawal-pin` (hashed server-side).
- Pi consent via `requestPiWalletConsent` + database authorization check.
- Idempotency key per amount intent.
- No fabricated success; Testnet A2U worker remains the settler.

---

## 6. Database changes

None in this package. Canonical migrations remain 189 from 0.330.4.  
Withdrawal PIN table and earnings quote/withdraw RPCs already present.

---

## 7. Security notes

- No plaintext PIN storage changes; existing hash path retained.
- Client never marks authorization active without server `uidMatchesAuthorization`.
- No new secrets or service-role exposure.

---

## 8. Test results

| Check | Result |
|-------|--------|
| Static review of open-transition guard | Applied |
| Duplicate CTA in compact mode | Hidden |
| Typecheck / full build in this sandbox | Not run (OOM risk / no full `npm ci` in this turn) |
| Live Testnet A2U settlement | Operator-side — requires funded Testnet worker |

Operator should verify on Preview:

1. Open Wallet → Pi rail → Withdraw.
2. Focus amount, type a value — sheet must stay open; amount must not clear.
3. Focus PIN fields — same.
4. Only one primary Withdraw visible on the wallet surface.
5. Close only via X or backdrop.

---

## 9. Remaining limitations (Phase 4 follow-on)

- Creator tipping end-to-end durability
- Seller payout lifecycle UI + reconciliation
- Full financial export / statements
- Further ScreenBoundary isolation so wallet errors never call `closeWallet` while a sheet is open
- Live E2E against Testnet A2U worker with non-zero withdrawable balance

---

## 10. Migration / deploy

1. Deploy 0.330.5 as usual (Vercel Preview first).
2. No new migrations required for this package.
3. Confirm env flags for earnings payout requests remain Testnet-gated.
4. Rollback: redeploy 0.330.4 artifact.

---

## 11. Change manifest (exact paths)

```
components/ghc/pi-withdraw-sheet.tsx
features/wallet/wallet-screen.tsx
components/ghc/unified-earnings-dashboard.tsx
package.json
VERIFIED_MANIFEST.txt
docs/GH-CONNECT-PHASE-4-IMPLEMENTATION-REPORT.md
```
