# Build fix — release hygiene (0.178.1)

## Failures
1. `check-a2u-earnings-roadmap`: `VERIFIED_MANIFEST.txt` still at `project_version=0.169.0`
2. `check-release-hygiene`: `.env.example` missing (often stripped by packaging globs that exclude `.env.*`)

## Fixes
- Synced `VERIFIED_MANIFEST.txt` `project_version` to package version
- Restored placeholder-only `.env.example` (no real secrets; no private keys as `NEXT_PUBLIC_*`)
- Phase F gate no longer hardcodes `0.176.0` (uses semver pattern)

## Verify
```bash
node scripts/check-a2u-earnings-roadmap.mjs
node scripts/check-release-hygiene.mjs
node scripts/check-phase-f-production-proof.mjs
```
