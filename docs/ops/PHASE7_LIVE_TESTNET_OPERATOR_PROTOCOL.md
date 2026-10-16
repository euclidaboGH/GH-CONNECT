# GH-CONNECT Phase 7 — Live Testnet Operator Protocol

**Purpose:** Convert static financial/authorization claims into real multi-user Testnet evidence.  
**Environment:** Vercel **Preview** → Testnet Supabase → **Pi Sandbox/Testnet** only.  
**Do not** use Production/Mainnet.  
**Do not** paste secrets, cookies, service-role keys, or passwords into chat.

## Prerequisites

| Item | Required |
|------|----------|
| Preview URL | e.g. `https://gh-connect-*.vercel.app` |
| Two distinct Pi Testnet accounts (User A, User B) | Yes |
| Each account completed Pi auth + GH session on Preview | Yes |
| GHC ledger migrations applied on Testnet Supabase | Yes |
| Optional: small legitimate spendable GHC on User A | For transfer tests |

## 0 — Environment attestation (fill TRUE / FALSE / UNKNOWN)

| Check | Answer |
|-------|--------|
| Preview URL is the intended Testnet deployment | |
| Supabase project is Testnet (not Production) | |
| `NEXT_PUBLIC_PI_SANDBOX` on Preview is `true` | |
| Pi server credentials on Preview are Testnet | |
| Production Mainnet config is separate | |

## 1 — Capture session (browser)

For User A and User B separately (Pi Browser or supported browser):

1. Open Preview URL → complete Pi authentication.
2. DevTools → Network → any authenticated API call → copy **Cookie** header value for GH session only (do not share publicly).
3. Note each user’s GreenHaven `userId` from `/api/economy/account` or profile (non-secret id only).

Use environment variables locally (never commit):

```bash
export PREVIEW_URL="https://YOUR-PREVIEW.vercel.app"
export COOKIE_A="GH_SESSION=..."
export COOKIE_B="GH_SESSION=..."
export USER_A_ID="gh_..."
export USER_B_ID="gh_..."
```

## 2 — Wallet IDOR

```bash
# A → A (expect 200)
curl -sS -o /tmp/wa.json -w "%{http_code}" \
  -H "Cookie: $COOKIE_A" -H "Accept: application/json" \
  "$PREVIEW_URL/api/economy/wallet/$USER_A_ID"

# B → B (expect 200)
curl -sS -o /tmp/wb.json -w "%{http_code}" \
  -H "Cookie: $COOKIE_B" -H "Accept: application/json" \
  "$PREVIEW_URL/api/economy/wallet/$USER_B_ID"

# A → B (expect 403)
curl -sS -o /tmp/ab.json -w "%{http_code}" \
  -H "Cookie: $COOKIE_A" -H "Accept: application/json" \
  "$PREVIEW_URL/api/economy/wallet/$USER_B_ID"

# B → A (expect 403)
curl -sS -o /tmp/ba.json -w "%{http_code}" \
  -H "Cookie: $COOKIE_B" -H "Accept: application/json" \
  "$PREVIEW_URL/api/economy/wallet/$USER_A_ID"
```

Record HTTP codes and that balances in allowed responses match only the session user.

## 3 — Forged sender (transfer)

```bash
REF="test_xfer_$(date +%s)"
curl -sS -H "Cookie: $COOKIE_A" -H "Content-Type: application/json" \
  -d "{\"toUserId\":\"$USER_B_ID\",\"amount\":1,\"referenceId\":\"$REF\",\"senderId\":\"$USER_B_ID\",\"userId\":\"$USER_B_ID\"}" \
  "$PREVIEW_URL/api/economy/transfers"
```

Expected: never debits User B; either rejects or executes only as User A (if step-up + balance allow).

## 4 — Duplicate transfer (same referenceId)

Submit the same body twice with the same `referenceId`.  
Expected: one ledger effect; second response idempotent / no second debit.

## 5 — Concurrent daily claim

```bash
curl -sS -H "Cookie: $COOKIE_A" -H "Content-Type: application/json" -d '{}' \
  "$PREVIEW_URL/api/economy/rewards/daily" &
curl -sS -H "Cookie: $COOKIE_A" -H "Content-Type: application/json" -d '{}' \
  "$PREVIEW_URL/api/economy/rewards/daily" &
wait
```

Expected: one successful credit path; other already-claimed / conflict; **not** two credits.

## 6 — Reward amount tampering

```bash
curl -sS -H "Cookie: $COOKIE_A" -H "Content-Type: application/json" \
  -d '{"amount":999999,"userId":"'"$USER_B_ID"'"}' \
  "$PREVIEW_URL/api/economy/rewards/daily"
```

Expected: server ignores client amount/user; no inflated payout.

## 7 — Unauthenticated

```bash
curl -sS -o /dev/null -w "%{http_code}" \
  "$PREVIEW_URL/api/economy/wallet/$USER_A_ID"
```

Expected: 401.

## 8 — Reconciliation (Supabase SQL Editor — read-only)

After tests, run aggregates only (no PII dumps):

```sql
SELECT user_id, count(*) AS n, sum(CASE WHEN kind IN ('spent','purchased','transfer_out') THEN amount ELSE 0 END) AS out_amt
FROM ghc_transactions
WHERE user_id IN ('USER_A_ID', 'USER_B_ID')
GROUP BY 1;
```

Compare counts/amounts to wallet snapshots. Do not paste service keys.

## Report back

Send engineering (no secrets):

- Environment attestation table  
- HTTP status codes for sections 2–7  
- Whether transfer/claim tests ran (and final balance consistency summary)  
- Any unexpected 200/5xx  

Until that evidence exists, Phase 7 live gate remains **incomplete**.
