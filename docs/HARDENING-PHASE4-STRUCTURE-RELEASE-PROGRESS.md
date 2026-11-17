# Hardening Phase 4 — Structure and release hygiene (DONE in source)

Base: `0.338.86`. Production remains **NOT APPROVED**.

## Completed

### Central Supabase REST client
- `lib/server/supabase/rest-client.ts` — `supabaseRpc`, `supabaseRest`, `getServiceSupabaseConfig`
- **0** remaining `/rest/v1/` string references under `lib/` (was 123)
- **54+** modules import the central client
- Tracker: `scripts/check-phase4-supabase-client.mjs` **13/13**

### Giant file splits (helpers first, stable APIs)
- `lib/marketplace/listing-presentation.ts` — `kindLabel`, `statusChip` extracted from `marketplace-screen.tsx`
- `contexts/ghc-context-hooks.ts` — stable re-export surface for consumer hooks
- Slice contexts exported from `ghc-context.tsx` for future deeper splits

### Image optimisation
- `next.config.mjs`: `unoptimized` gated by `GHC_IMAGE_OPTIMIZATION=1`
- Expanded `remotePatterns` for Supabase storage + minepi

### Delivery hygiene
- `LATEST-PROJECT-BUNDLE-README.md` refreshed with phase status + package SHA habit
- Superseded non-0.338 `UPGRADE-WORKLOG-*` archived under `docs/archive/upgrade-worklogs/`

## Operator notes
- Set `GHC_IMAGE_OPTIMIZATION=1` when the deployment supports Next image optimizer
- Production remains NOT APPROVED
