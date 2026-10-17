# Vercel install fix — Playwright registry timeout

## Error

```
npm error network request to http://35.245.43.102/npm/playwright-core/-/playwright-core-1.55.0.tgz failed
connect ETIMEDOUT 35.245.43.102:80
```

## Root cause

`package-lock.json` had `resolved` URLs for `@playwright/test`, `playwright`, `playwright-core`, and `fsevents` pointing at a non-public host (`35.245.43.102`) instead of `registry.npmjs.org`. Vercel `npm ci` followed those URLs and timed out.

Playwright is a **devDependency** (E2E only). Production runtime does not need it, but `npm ci` still installs the full tree including locked `resolved` URLs.

## Fix

- Rewrote those four `resolved` entries to `https://registry.npmjs.org/...`
- Left integrity hashes unchanged (same package versions)
- `.npmrc` already sets `registry=https://registry.npmjs.org/`

## Operator note

E2E remains: `npm run test:e2e` after local `npx playwright install` when needed.
