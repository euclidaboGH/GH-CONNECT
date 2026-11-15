# UPGRADE-WORKLOG 0.338.83

## Summary
Restore missing `.github/workflows/ci.yml` (Run #300 integrity) and professional post-card action-key layout across feed, profile, and community surfaces.

## Blocking fix
- Run #300 failed with ENOENT on `.github/workflows/ci.yml` during Vercel prebuild.
- Added least-privilege CI workflow: `contents: read`, Node `24.15.0` in static + build jobs, lock integrity before `npm ci`, RLS + security-definer ACL gates, no migration apply / no `vercel --prod` / no `pull_request_target`.

## Post cards (feed / profile / community)
1. `EnhancedPostCard` uses `rounded-[var(--gh-fb-card-radius)]` so FB chrome tokens apply consistently.
2. `data-post-surface` remains set for feed, profile, and community wrappers.
3. Action dock gains a clear hairline separator and FB-toned respond row (Comment / Save / Share).
4. Secondary respond actions drop heavy borders for a cleaner FB/X strip.
5. CSS block `0.338.83 — post action keys layout` standardises toolbar colour, hover, and padding.
6. Curation language retained: aria-label includes **Community curation** (Phase 16).
7. Touch targets remain `min-h-11` on vote and respond controls.
8. Reaction summary + quality vote pill layout retained.

## Identity
- package / lock / APP_RELEASE / VERIFIED_MANIFEST / PROJECT_TRUTH / SOURCE_OF_TRUTH → `0.338.83`.

## Verification notes
Source-only. Production remains **NOT APPROVED**. Re-run full static suite on Node 24.15.x after push.
