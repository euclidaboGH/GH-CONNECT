# Wallet transaction audit — 2026-11-07
Fixed in this patch (F) / needs an operator or product decision (D).

1. F  Withdrawal PIN was only checked in the browser; /api/economy/earnings/withdrawals never verified it. Now requires a server-issued HMAC proof bound to user + idempotency key (5 min TTL). Needs GH_PIN_PROOF_SECRET.
2. F  PIN attempt limit was read-then-write (race): parallel guesses could exceed 5 attempts. Now counted atomically under a row lock before comparison (gh_withdrawal_pin_begin_attempt).
3. F  PIN routes used an in-memory rate limiter (per serverless instance). Now durable, deny-on-unavailable.
4. F  gh_withdrawal_pins.user_id was uuid + FK to auth.users while app user ids are text; Pi-auth users can fail PIN creation. Converted to text, FK dropped.
5. F  No way for a user to release a reservation that never started. Added /withdrawals/cancel + wallet button (same safe criteria as the operator script).
6. F  Weak PINs (000000, 123456...) accepted. Rejected server-side on set and recovery reset.
7. F  PIN recovery reset had no cooldown (stolen-session risk). 24h withdrawal cooldown after reset.
8. F  UI told end users "Operator must apply the migration". Replaced with a user-safe message.
9. D  No scheduler runs payouts: vercel.json has no cron and /withdrawals/execute needs a user session + executor key. Reserved requests are never processed automatically.
10. D  /withdrawals/execute checks wallet authorization against the CALLER (auth.userId), not the request owner (row.user_id). Worker identity and request ownership should be separated.
