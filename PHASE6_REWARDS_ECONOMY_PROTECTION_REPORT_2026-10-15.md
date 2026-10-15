# GreenHaven Phase 6 — Rewards & Economy Protection

## Completed fixes

1. **Reward evaluation contract repaired.** The HTTP repository previously sent `{amount, reason, sourceEvent, referenceId}` and silently dropped `targetId` and `metadata`. This broke server anti-abuse checks for target-bound rewards and unnecessarily transmitted a client amount. The server-mode contract now sends only event evidence: `sourceEvent`, `referenceId`, optional `targetId`, and optional `metadata`.
2. **Client-suggested reward amount removed from the normal server-mode path.** Reward amount remains derived from the server rule catalog/emission governor.
3. **Emission-adjusted amount preserved.** Client reward records previously used static `rule.amount` even when the server's emission/cap system granted a different amount. Reward metadata now uses the amount returned by the authoritative server response.
4. **Claim → wallet synchronization repaired.** The claim API now returns a fresh full-ledger `ghc_wallet_snapshot`; the HTTP repository stores it immediately. This prevents a successful claim from temporarily showing a balance recomputed from a bounded activity list.
5. **Server claim result now uses the authoritative wallet helper** rather than recomputing wallet totals from recent transactions.
6. Existing protections retained: unique references/idempotency, pending-before-available lifecycle, daily/weekly emission caps, cooldowns, per-target caps, self-target checks, database atomic staging, and database-authoritative claiming.

## Security finding retained for Phase 8 integration hardening

`/api/economy/rewards/evaluate` is still a user-authenticated event-reporting endpoint. Although users cannot choose the amount and durable caps/cooldowns constrain abuse, a high-assurance production economy should eventually move reward issuance behind server-attested domain events (post/comment/order/referral/challenge handlers) rather than accepting a client assertion that an eligible event occurred. This was not converted wholesale in Phase 6 because doing so without wiring every producer would silently disable legitimate rewards. It should be closed during final integration after all event producers are mapped.

## Verification

- `node scripts/check-jsx-safety.mjs`: PASS — 613 files scanned.
- Full `next build`: unavailable in this extracted project because dependencies are not bundled (`next: not found`). No lint/type/build bypass was added.

## Files changed

- `lib/domains/economy-domain.ts`
- `lib/domains/http-repositories.ts`
- `app/api/economy/rewards/claim/route.ts`

No Pi payment, membership entitlement, marketplace order, escrow, or withdrawal business rules were changed.
