# Production 50 — CMRSW (G)

Baseline: NEW-INTERNAL-IDENTITY

## Auth (1–12)
Daily evaluate/claim credentials, journey daily auth, wallet claim+clientRequestId, GHPV, ranking impressions, reward GET, offline claim

## Events (13–18)
ghc:toast→addToast, ghc:wallet-focus, ghc:open-community-compose, ghc:compose-prefill

## Messages (19–28)
apiSendMessageWithRetry, domain wired, clientMessageId, offline draft, mark-read on visibilitychange, Escape, authHeaders

## Community (29–36)
openCreateCommunity harmonized, Escape, join offline, leave offline

## Stories (37–40)
blob: blocked before publish, socialViewStory on seen, social client auth

## Ranking/curation (41–45)
Impressions auth, document.hidden, filter persist, curation offline+debounce

## Reputation/wallet (46–50)
Badge loading/fail-soft/TTL, walletOnline, daily wallet-refresh, claim idempotency

No ledger/RLS/ranking algorithm changes.
