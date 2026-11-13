# Run #300 — 20-point release and CI hardening

**Candidate:** `0.338.64` derived from Run #299 / `0.338.63`.

## Root cause

The Phase 1–10 upgrade pack's P10-B check relied on case-sensitive matching for `NOT APPROVED`, while the policy wording is not guaranteed to use identical capitalization. The assertion now uses case-insensitive matching and also verifies the current project-truth release status. The CI migration prohibition remains independently asserted.

The Phase 1 audit register still identified `gh-connect@0.338.62`, causing its P1-A version/source-truth check to fail after Run #299. Its active package pointer is synchronized with the executable package version.

## Twenty controls

1. package/lockfile version parity; 2. app release identity; 3. README version; 4. project-truth version; 5. verified manifest version; 6. phase audit version; 7. case-insensitive release no-go policy; 8. P10-B checker regression; 9. workflow inventory; 10. no Supabase migration push; 11. no Prisma migration deploy; 12. no Drizzle schema push; 13. no automatic Vercel production deploy; 14. read-only repository permissions; 15. no `pull_request_target`; 16. exact Node 24.15.0; 17. lock-integrity-before-install ordering; 18. dependency upload exclusion; 19. build/cache upload exclusion; 20. local environment/archive exclusion.

## Safety and limits

No dependencies were changed. No migration was applied, no payment or provider operation was initiated, no GitHub push was made and no Vercel deployment was triggered. The Vercel 691 MB source-footprint report cannot be safely attributed from the summary alone; the five large entries include Vercel cache and Next SWC native binaries. Existing `.vercelignore` exclusions are preserved. A fresh Preview upload/build report is required to determine whether application source, generated files or platform-mounted dependencies account for the reported size.

**Production remains NOT APPROVED.** Node 24.15.0 dependency-backed typecheck, lint, Next.js build and fresh Vercel Preview remain required.
