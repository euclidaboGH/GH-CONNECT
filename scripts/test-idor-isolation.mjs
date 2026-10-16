#!/usr/bin/env node
/**
 * IDOR isolation helper — documents required manual tests.
 * Does not call production with real tokens (no secrets).
 * Exit 0 always after printing the checklist so CI can optional-run it.
 */
console.log(`
=== IDOR / isolation checklist (manual on Staging) ===

Use two Pi test accounts A and B.

[ ] GET /api/profile/me as B → only B
[ ] PATCH profile with body userId=A → no write to A
[ ] Wallet/economy as B with A's id → 403 or self only
[ ] Messaging list as B → no A's private threads
[ ] GET messages for A's conversation as B → 403
[ ] Notifications as B → no A's items
[ ] Expired session → 401
[ ] Bearer user:… on Production → rejected
[ ] Logout then reuse cookie → 401

See docs/IDOR_TEST_CHECKLIST.md
`)
process.exit(0)
