# UPGRADE-WORKLOG 0.338.75

## Blocking fixes
1. Run #269: `docs/SOURCE_OF_TRUTH.md` exact package release line synchronized to `0.338.75`.
2. Vercel webpack cache: prepare script cleans `.next/cache/webpack` and `.next/cache`; buildCommand always follows with shell rm.
3. Community post engagement metrics use `normalizeEngagementMetrics` (required numbers).
4. `lib/social/client.ts` safeNextCursor (no duplicate cursor identifier).

## 20 upgrades
1. Source-of-truth package identity single line of truth.
2. Aggressive stale Webpack pack eviction before Next compile.
3. Fail-soft cache clean when prepare is slow.
4. Type-safe community engagement merge.
5. Community post pagination cursor validation.
6. Canonical nav contract retained.
7. Manifest / app-release / package lock triple sync.
8. Phase 24 baseline identity.
9. ACL migration inventory retained.
10. Testnet reconciliation Mainnet hold retained.
11. Browser surfaces remain free of Supabase client writes.
12. No public Supabase credentials in client bundles.
13. Messaging bounded JSON suite unchanged.
14. Social upstream timeouts retained.
15. Membership rate limits retained.
16. Withdrawal health read-only probe retained.
17. Pi wallet_address least-privilege consent retained.
18. Production remains NOT APPROVED.
19. Source-only worklog documentation.
20. Flat GitHub root layout required for Vercel Root Directory `.`

## Source-only verification
Node.js 24.15.0. Source-level only. Production **NOT APPROVED**.
