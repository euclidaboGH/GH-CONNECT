# GH-CONNECT 0.62.1 — Phase 21 release gate

**Status: NOT CLEARED FOR PRODUCTION DEPLOYMENT.** Source-level UI and safety checks pass, but the dependency lock is incomplete for the newly declared `pi-backend@0.1.3` dependency and the clean install/build gates remain unverified.

## Before pushing the release candidate

1. On a registry-connected Node 24.15+ environment, run `npm install --package-lock-only --legacy-peer-deps` and review the full `package-lock.json` diff.
2. Run `npm ci --legacy-peer-deps`, `npm run typecheck`, `npm run lint`, `npm run ci:verify`, and `npm run build`.
3. Fix every real TypeScript/lint/build error; do not disable checks or bypass the lockfile.
4. Review `VERIFIED_MANIFEST.txt` and `docs/MIGRATION_CHECKLIST.md`; do not blindly apply all SQL migrations.
5. Run the Phase 20 Pi A2U Testnet and GHC settlement concurrency plans on disposable infrastructure before enabling flags.
6. Keep bank payouts disabled until a real provider, beneficiary verification, webhooks and reconciliation are integrated and tested.
7. Verify desktop/tablet/mobile layouts in real browsers, including Pi Browser, Android Chrome, keyboard-only navigation, zoom, dark mode and theme presets.

## Checks already passed in this source workspace

- Phase 21 premium UI static assertions: 14/14.
- Release hygiene: 10/10.
- Migration inventory synchronization: passed.
- Production safety scan: 21/21.
- Phase 20 payout adapter checks: 19/19.
- Phase 19 financial/media checks: 29/29.

No Supabase migration was applied and no GitHub/Vercel action was taken.
