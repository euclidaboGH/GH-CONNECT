# Pi withdrawal, consent, identity & cart/wallet separation — 0.338.16

## Problems observed (device recording)
1. Withdraw sheet showed **Max · 0.00 π** after open/reopen while balance existed → looked like funds were reserved/lost.
2. UI stuck on **Checking payout consent…** with no timeout.
3. Consent checkbox + **Authorize** did not complete; **No quote was requested**.
4. Fee review looked like a reservation.
5. Cart and wallet surfaces needed clearer separation.

## Fixes (source)

### Wallet / Pi withdrawal
- Stop clearing `piWithdrawAvailable` to null on every sheet open (wallet-screen).
- Sticky max inside `PiWithdrawSheet` so parent null re-hydrate cannot wipe Max mid-session.
- `loadAuth` 10s timeout + user-visible retry error.
- Footer/copy: fee preview **does not reserve**; lock only after PIN-confirmed accepted request.
- `lib/wallet/withdrawal-reservation-policy.ts` — RESERVE_ON_QUOTE/CONSENT = false.

### Identity (5)
1. AuthSnap + status carry `authorizedPiAppUid`.
2. Identity panel: GH session, linked Pi username, truncated Pi UID, authorization state.
3. Mapping-required messaging when `hasMapping === false`.
4. Explicit KYC-bound destination copy (no raw address entry in sheet).
5. Client consent status parses `authorizedPiAppUid`.

### Consent (5)
1. Timeout on authorization status fetch.
2. Pi Browser-only message for PI_AUTH_UNAVAILABLE retained and surfaced.
3. Consent errors remain visible with retryable flag.
4. Sticky balance during consent check.
5. Identity panel always visible during consent step.

### Cart vs wallet (10 controls in module)
`lib/commerce/cart-wallet-separation.ts`: separate surfaces, primary actions, badge isolation, route assertions, policy string.

## Gate
`scripts/check-pi-withdraw-consent-identity-0.338.16.mjs` — 12/12.

## Still operator / environment
- Pi.authenticate only works inside **Pi Browser** with linked mapping.
- Testnet A2U worker must be enabled and funded.
- Live PostgreSQL reservation release for stuck requests remains operator-owned.
- Production **NOT APPROVED**.
