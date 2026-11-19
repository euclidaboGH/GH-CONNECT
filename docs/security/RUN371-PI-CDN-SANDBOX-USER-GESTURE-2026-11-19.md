# RUN371 — Pi CDN Sandbox user-gesture preservation

Date: 2026-11-19  
Base: GreenHaven 0.338.100 / RUN339 archive (internal bundle directory `run359`)  
Source patch: RUN371 (package version remains 0.338.100 until the next coordinated release cut)  
Scope: Pi Sandbox frame recognition and authentication invocation path.

## Evidence

The supplied Pi Browser diagnostic reported `sandbox=true`, `inIframe=true`, and `referrerHost=app-cdn.minepi.com`, while `sandboxFrame=false`. The current frame classifier recognized only `sandbox.minepi.com` and its subdomains. Consequently the sign-in retry entered the non-Sandbox branch and awaited `requestParentCredentials()` before calling `Pi.authenticate`. At the later invocation, the browser reported `userActivationActive=false`. The SDK then rejected `Pi.authenticate` before GreenHaven's `/api/auth/pi` server verification route could be reached.

This is a concrete local control-flow mismatch consistent with the supplied trace. It does not prove that every Pi SDK rejection has this cause or guarantee Pi's external authorization service will accept the next request.

## Change

- Recognize the exact `app-cdn.minepi.com` referrer as an additional Pi Sandbox wrapper host.
- Retain the existing Testnet-mode requirement and iframe requirement. A top-level page cannot be classified as a Sandbox frame from referrer alone.
- The existing Sandbox path now skips the unrelated asynchronous App Studio parent-credential probe for this wrapper, allowing the already-initialized SDK's `Pi.authenticate` invocation to occur synchronously within the user's tap task.
- Preserve username-only login scope, single-flight behavior, timeout, mandatory server-side Pi `/v2/me` verification, and no local identity fallback.
- Add a dedicated RUN371 regression contract and register it in `prebuild:checks` and `verify:static`.
- Keep package and lockfile versions synchronized at 0.338.100; defer the version increment until the broader source-of-truth release metadata is updated together.

## Verification

- RUN371 Pi CDN Sandbox gesture contract: 9/9 PASS.
- RUN353 Pi auth root-cause regression: 16/16 PASS.
- RUN370 rejection metadata: 7/7 PASS.
- RUN343 timeout/retry: 8/8 PASS.
- RUN344 diagnostics UX: 10/10 PASS.
- RUN339 auth-unblock contract: 10/10 PASS.
- Full `npm run verify:static`: PASS.

## Not performed / limitations

No GitHub push, Vercel deployment, Pi Developer Portal change, Supabase migration, or Mainnet operation was performed. The local runtime did not contain `node_modules`, and the available Node runtime was v22.16.0 while the project requires Node `^24.15.0`; therefore a clean install, TypeScript check, production build, and live Pi Browser acceptance test were not performed. Deploying this patch to the existing Testnet preview and retesting from Pi Browser is required to confirm whether the observed user-activation mismatch is resolved.
