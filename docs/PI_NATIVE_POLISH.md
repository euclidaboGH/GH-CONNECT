# GH CONNECT — Pi-native polish (Step 4)

Align product surfaces with official Pi capabilities (Sep 2026 blog + SDK):

| Capability | Official note | GH CONNECT |
|------------|---------------|------------|
| `Pi.openShareDialog` | OS share sheet for text | `lib/pi-native.ts` → profile, posts, communities |
| `Pi.shareFile` | File/video share | `shareFile()` with Web Share fallback |
| Incomplete payments | `authenticate(..., onIncompletePaymentFound)` | Wired in auth; recovery API; toast via `ghc:payment-recovery` |
| Local storage | Whitelist; device-scoped; not permanent | `lib/pi-local-storage.ts` — prefs only, never secrets |
| Staking Data API | App-specific effective stake; whitelist | `/api/pi/staking` stub; `PiSupporterBadge` product signal only |

## Security boundaries

- Stake tier is **not** payment authority, GHC balance, or step-up substitute.
- Incomplete recovery always hits **server** `/api/payments/incomplete`.
- Share never exposes session tokens or PINs.
- Local storage never stores access tokens, PINs, or ledger authority.

## Operator

1. Keep `PI_API_KEY` + network mode correct (Step 1).
2. Set `PI_STAKING_API_ENABLED=true` only after Pi whitelist + documented Platform endpoint.
3. Test share + incomplete recovery inside **Pi Browser**.

## Out of scope

- Inventing Platform staking endpoint shape before docs confirm it.
- Ranking Discover by client-claimed stake amounts.
