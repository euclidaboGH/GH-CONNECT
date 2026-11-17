# CI lint and build remediation audit — 0.338.97 / Run 315

## Source baseline
The user-designated source archive remains `GREENHAVEN-0.338.93-RUN312-NOTIFICATION-RPC-FIX-2026-11-17.zip`. This 0.338.97 tree is a local derivative of the previous 0.338.96 working candidate and does not supersede that archive.

## Supplied failures and fixes

| Finding | Remediation |
|---|---|
| `@next/next/no-html-link-for-pages` on `/` in public research form | Replaced internal anchors for `/` and `/privacy` with `next/link` `Link`. |
| Unknown `@typescript-eslint/no-require-imports` rule directives in `lib/secure-id.ts` | Removed the invalid directives; cryptographic implementation retained. |
| React Hook dependency warning in `deleteComment` | Added `state.posts` to the callback dependency array. |
| Pass 14 product-design gate hard-coded release `0.236.0` | Gate now compares package version with the in-app release version. |
| Pass 14 shared section hierarchy failed | Reusable heading now emits `gh-section-title`, which the shared CSS already styles. |
| Next diagnostics artifact had no files after early build failure | CI now creates `.next/diagnostics/ci-failure-context.txt` before artifact upload. |

## Verification
- Run 315 regression checks: 9/9.
- Pass 14 product-design: 8/8.
- Run 314 screen-experience: 15/15.
- Run 313 transaction coordinator source: 8/8.
- Release hygiene: 17/17.
- Project truth: 11/11.
- JSX safety: 1,154 files.
- `npm run verify:static`: passed.

## Remaining validation
The working container has no installed `node_modules` and runs Node 22.16.0, not the required Node 24.15.0. Consequently, this audit does not claim that ESLint, TypeScript or the Next production build passed locally. The new GitHub Actions run must confirm those dependency-backed checks. No GitHub push, Vercel deployment, Supabase mutation, migration application, wallet or payout operation was performed. Production remains NOT APPROVED.
