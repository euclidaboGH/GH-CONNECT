# RUN353 — Pi Authentication Root-Cause Isolation

Date: 2026-11-18  
Baseline: `GREENHAVEN-0_338_99-RUN352-ENV-CLEANUP-SOURCE-OF-TRUTH-2026-11-18-3.zip`  
Target: Pi Developer Sandbox / Testnet only

## Verified evidence

- Vercel's latest `testnet` deployment at audit time was `READY` on commit `1cd07434a730f0c93b097f759dafcad7f2509583`.
- GitHub blob hashes for `lib/pi-runtime.ts`, `contexts/pi-auth-context.tsx`, `components/auth-loading-screen.tsx`, `lib/pi-env.ts`, and `app/layout.tsx` matched the uploaded archive exactly. This confirms the deployed source revision for the authentication-critical files; it does not prove that Pi's external authorization prompt succeeds.
- User diagnostics show `sandbox=true`, `inIframe=true`, and `referrerHost=sandbox.minepi.com`; SDK initialization succeeds, while `Pi.authenticate()` rejects with the generic SDK message before `/api/auth/pi` is reached.
- The previous Sandbox warning was assembled separately from the diagnostic report. RUN353 now uses shared Sandbox-frame evidence and reports origin, referrer host, iframe state, and recognised Sandbox-frame state together.

## Changes

1. Added `isPiSandboxFrame()` requiring Testnet mode, iframe framing, and the exact trusted `sandbox.minepi.com` referrer host.
2. Made the Sandbox warning and diagnostic report use the same frame evidence. A framed Sandbox page is no longer told to open the Sandbox link again.
3. Added origin, referrer host, iframe and Sandbox-frame fields to the token-free runtime snapshot/report.
4. Added `PI_AUTH_INVOKE_CONTEXT` with `navigator.userActivation.isActive` when the browser exposes it. No credentials or identity values are logged.
5. Sandbox page bootstrap now initializes the official Pi SDK but waits for an explicit sign-in tap before calling `Pi.authenticate()`.
6. Sandbox authentication skips the unrelated App Studio parent `postMessage` credential probe.
7. When Pi SDK initialization is already complete, `piAuthenticateOfficial()` invokes `Pi.authenticate()` synchronously before returning its promise. This avoids an additional awaited initialization step between the user's tap and the SDK prompt.
8. The Sandbox sign-in button explicitly routes through the Pi SDK even if user-agent detection is inconclusive; a signed-out Sandbox session also waits for SDK preload before showing the actionable button.
9. Removed the optional post-login commerce bootstrap's second `pi.auth.login()` / `sdkLite.login()` calls and removed the legacy adapter's extra `Pi.authenticate(["username", "payments"])` prompt. The already-verified identity flow remains the single sign-in authority; payment permission remains a separate, explicit flow.

## Security boundaries preserved

- Identity sign-in requests only `username`.
- Wallet permission remains an explicit wallet-consent flow.
- Client UID is not trusted as final identity.
- `/api/auth/pi` remains the required server verification/session boundary; server verifies the Pi access token using Platform `GET /v2/me`.
- Local preview fallback remains disabled on Vercel/Pi hosts.
- Testnet/Mainnet resolution and payment/economy boundaries are unchanged.
- No server API key, access token, username, Pi UID, cookie, or request body is added to diagnostics.

## Regression checks

`node scripts/check-run353-pi-auth-root-cause.mjs` — 16/16 passed.

Existing RUN338, RUN342, RUN343, and RUN344 checks are retained and must also pass. Full typecheck/build has not yet been run because this archive does not contain `node_modules`.

## Remaining external verification

A live Pi Sandbox session is required to determine whether the rejection was caused by the previous non-user-gesture/bootstrap path. After deployment, copy diagnostics immediately after tapping **Sign in with Pi**. Check whether `PI_AUTH_INVOKE_CONTEXT` reports `userActivationActive=true`, followed by `PI_AUTH_PROMPT_OK` or a rejection. If the SDK still rejects while user activation is true, the next investigation is the Pi-side Sandbox authorisation/account/app registration state; no evidence currently identifies a specific server-side cause.
