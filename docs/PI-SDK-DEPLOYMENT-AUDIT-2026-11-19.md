# GreenHaven Pi SDK and Vercel Deployment Audit — 2026-11-19

Release: `0.338.108`  
Baseline: `0.338.107` source archive  
Scope: deployment packaging, Content Security Policy, Pi SDK script loading and Pi authentication boundaries.

## Confirmed deployment failure

The Vercel log fails in `scripts/check-run376-economy-curation-integrity.mjs` because `.env.example` is absent from `/vercel/path1`. The uploaded source archive contains `.env.example`, while `.vercelignore` used `.env*` followed by `!.env.example`. Vercel's deployment upload removed the template despite the negation rule. This is a source-packaging failure before Next.js compilation; it is not evidence of a Pi authentication rejection.

## Changes in 0.338.108

1. Replaced the broad `.env*` Vercel ignore with explicit local secret filenames. `.gitignore` remains responsible for excluding untracked local secrets; `.env.example` remains tracked and is no longer matched by a broad Vercel pattern.
2. Updated Vercel ignore regression checks (RUN289, RUN299, RUN300, RUN337 and build hygiene) to assert the safer explicit policy.
3. Added an actionable early error to RUN376 when `.env.example` is missing, instead of exposing a raw `ENOENT` stack trace.
4. Audited the actual configured Pi SDK URLs in `lib/system-config.ts`. The primary SDKLite script at `pi-apps.github.io` and jsDelivr fallback were not in CSP `script-src`; the `@swetate` Pi plugin backend host was not in `connect-src`. Added those exact origins, retaining the official `sdk.minepi.com` origin and existing Pi host allowances.
5. Extended the RUN371 Pi Sandbox regression to check those CSP allowances.
6. Synchronized package, lockfile, app release, README, project truth and build context to `0.338.108`.

## Pi authentication/security boundaries reviewed

- Official identity sign-in continues to request only `username` scope.
- Client access tokens are still sent to `/api/auth/pi` and verified server-side through Pi Platform `/v2/me` before a GreenHaven identity/session is issued.
- Durable identity and session storage remain mandatory in production.
- Wallet address permission remains a separate explicit consent flow.
- No local preview identity fallback is enabled on Vercel/Pi production hosts.
- Sandbox iframe recognition remains constrained to Testnet mode, an iframe, and exact trusted referrer hosts (`sandbox.minepi.com`, its subdomains, or `app-cdn.minepi.com`).
- The explicit sign-in tap, single-flight guard, bounded authentication timeout, and token-free diagnostics remain in place.
- No changes were made to payment approval/completion, wallet balances, GHC issuance, Pi transfer, withdrawal, identity mapping, or database authority.

## Remaining external verification

Static source inspection cannot establish that Pi's external SDK/CDN, Pi Browser bridge, Developer Portal app registration, API key, or Testnet payment endpoints are healthy. After deploying this revision to the Testnet Preview, verify from the registered app opened inside Pi Browser:

1. SDK script loads and `Pi.init({ version: "2.0", sandbox: true })` succeeds.
2. Explicit sign-in tap records `userActivationActive=true` where the browser exposes that property.
3. `Pi.authenticate(["username"])` returns a token; the token is never logged.
4. `/api/auth/pi` verifies `/v2/me`, resolves the mapped identity and sets the durable HttpOnly session cookie.
5. `/api/auth/session` confirms the cookie session.
6. Optional SDKLite commerce initializes without undoing successful identity authentication; test products, purchase, restore and incomplete-payment recovery separately in Testnet.
7. Test wallet-address consent independently from username sign-in.

The prior Vercel log shows commit `e49ddbf` and package `0.338.106`, not this `0.338.108` source. This repair must be committed/pushed to the `testnet` branch and a new deployment must use the new commit before it can be evaluated.

## Verification limits

No live Pi Browser session, Developer Portal inspection, Vercel deployment, Supabase migration, payment, wallet, or Mainnet operation was performed. Source-level regression checks are not equivalent to live SDK acceptance. Production remains not approved.
