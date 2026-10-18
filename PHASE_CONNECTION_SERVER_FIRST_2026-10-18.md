# Connection & follow — server-first (2026-10-18)

## Problem
Connect / follow updated the **local session graph first**, then dual-wrote. Recipients never saw requests when durable write failed.

## Fix
- `sendUnifiedConnectionRequest` / `acceptUnifiedConnectionRequest`: API + `durable` required before session graph
- `postJson`: `credentials: "include"` + Identity auth headers
- `followUser` / `addFriend` in GHC context: same server-first pattern
- Honest errors when server is unavailable or not durable

## Test
`npm run test:connection-server-first`

## Live still required
Apply connection migrations + two-account inbox test on Testnet.
