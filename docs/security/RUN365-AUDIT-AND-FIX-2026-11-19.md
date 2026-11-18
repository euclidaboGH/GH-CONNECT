# RUN365 — Full source audit and documentation-gate repair

Date: 2026-11-19
Base: RUN364 full project archive

## Findings and repairs

The reported Vercel failure at prebuild check 143/396 was caused by `scripts/check-pass38-data-contracts.mjs` reading `docs/release-0.260.0-pass38.md` directly. The release note is intentionally preserved at `docs/archive/historical-implementation-records/docs__release-0.260.0-pass38.md`.

The checker now uses the existing `readProjectDoc()` helper from `scripts/lib/read-project-doc.mjs`. This preserves the archived document and validates its original content without copying or moving historical records.

A source scan of all `scripts/check-*.mjs` files found the same direct-read/archive-location defect in these additional registered gates:

- Pass 30 experience quality (`release-0.252.0-pass30.md`)
- Pass 31 workflow experience (`release-0.252.0-pass30.md`)
- Pass 32 action clarity (`release-0.252.0-pass30.md`)
- Pass 33 journey guidance (`release-0.255.0-pass33.md`)
- Pass 36 system integrity (`release-0.259.0-pass37.md`)
- Pass 37 architecture decomposition (`release-0.259.0-pass37.md`)

These checkers now use the same shared document resolver. The existing Phase 8 and Phase 9 repairs are retained. RUN333 already had its own historical-document fallback and was left unchanged.

## Focused verification

- Pass 30: 9/9
- Pass 31: 8/8
- Pass 32: 8/8
- Pass 33: 9/9
- Pass 36: 8/8
- Pass 37: 8/8
- Pass 38: 12/12
- RUN333 Testnet security reconciliation: 11/11

The project prebuild chain was attempted in this audit environment but could not complete: this container has Node.js 22.16.0 while the project requires `^24.15.0`, and the archive intentionally excludes `node_modules`. The chain subsequently reached `check-jsx-duplicate-props.mjs`, which could not resolve the `typescript` package because dependencies were not installed. This is an environment limitation, not a passing full-prebuild result.

## Security gate — intentionally unresolved

The RUN364 npm audit snapshot still reports 22 dependency findings: 2 critical, 13 high, 6 moderate, and 1 low. This source-only repair does not change `package.json`, `package-lock.json`, or the dependency-security policy. No `npm audit fix --force`, lockfile override, or security-gate bypass was applied.

The audit snapshot identifies fix-available updates for Next.js (15.5.29), DOMPurify, Playwright, Sharp, Undici, and other transitive packages. It also reports unresolved transitive exposure through `stellar-sdk` / `pi-backend` involving Axios and TOML, with no safe automatic fix reported. These require dependency-graph review, compatible upgrades, and a fresh `npm ci` plus audit in the project's required Node 24.15.0 environment.

## Release safety

- Production remains **NOT APPROVED**.
- No Vercel deployment was performed.
- No GitHub push was performed.
- No Supabase migration was applied.
- Mainnet was not accessed or changed.
- Testnet-only and financial safety gates were not weakened.
