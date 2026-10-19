# GreenHaven — Pi Core Team developer-guidance compliance review

**Review date:** 2026-10-19  
**Project baseline:** GH-CONNECT 0.62.3 / Phase 23  
**Evidence class:** source inspection + static regression checks. This is not a Core Team certification, a live Pi Browser test, or proof that Developer Portal configuration is correct.

## Official source set reviewed

Use these Core Team documentation pages as the source of truth; re-check them before every Pi SDK upgrade because the platform evolves:

- Getting started and app architecture: https://developers.minepi.com/docs/build-first-app/GettingStarted
- Register app and immutable network choice: https://developers.minepi.com/docs/build-first-app/RegisterApp
- Official frontend SDK reference: https://developers.minepi.com/docs/api-reference/SdkReference
- Authentication and server-side identity verification: https://developers.minepi.com/docs/authenticate-user/Authentication
- U2A payment handshake: https://developers.minepi.com/docs/accept-payment/Payments
- Platform API (server-side identity, payments, ads, notifications): https://developers.minepi.com/docs/api-reference/Platform
- A2U advanced payments: https://developers.minepi.com/docs/accept-payment/PaymentsAdvanced
- Official Pi Node.js A2U SDK: https://github.com/pi-apps/pi-nodejs
- Ads and rewarded-ad verification: https://developers.minepi.com/docs/setup-ads/Ads
- PiNet app registration/accessibility: https://developers.minepi.com/docs/build-first-app/PiNet
- PiNet URL/security updates: https://developers.minepi.com/docs/use-native-features/PiNetURLupdates
- Token guide (Testnet): https://developers.minepi.com/docs/use-native-features/Tokens
- Common integration mistakes: https://developers.minepi.com/docs/troubleshooting/CommonMistakes
- Developer terms/licensing overview: https://developers.minepi.com/docs/concepts/License/
- Pi platform source documentation (payments, SDK reference, platform API): https://github.com/pi-apps/pi-platform-docs

## Conformity requirements and source findings

| Area | Core Team requirement | Source status | Required operational evidence |
|---|---|---|---|
| Official SDK | Load `https://sdk.minepi.com/pi-sdk.js`; call `Pi.init({version:"2.0", sandbox:...})` before any other Pi SDK method. | Root layout includes the official script; Phase 23 runtime now fails closed if `Pi.init` is missing or throws, and U2A does not continue after init failure. | Open the exact registered app URL in Pi Browser; confirm `Pi.init` runs once and the SDK is available after reload. |
| App registration/network | Register in Developer Portal. App network is immutable after registration; test and mainnet use separate registered apps/configuration. | Runtime supports sandbox/mainnet selection, but repository code cannot prove Developer Portal network, URL, API key or deployed environment match. | Capture separate Preview/Testnet and Production/Mainnet configuration evidence. Never assume a build flag can convert a registered Testnet app to Mainnet. |
| Authentication | Only trust user identity after server-side `/v2/me` verification of the SDK access token; keep server API key server-side. | `pi-runtime.ts` uses official client auth; `/api/auth/pi` performs server-side verification and establishes the GreenHaven session. | Test expired/tampered token, canceled auth, returning-user login, revoked permissions, and Pi Browser reload. |
| Least privilege | Request only the scopes needed for the feature; payments requires `payments`. | Shared app authentication currently requests `username` and `payments` because commerce exists. This is a product-wide choice to revisit if login can be split from checkout. | Verify actual consent UX and whether a username-only initial session plus just-in-time payment authorization is feasible without breaking the SDK payment flow. |
| U2A payment | Backend must bind payment to an authorized durable intent, verify expected amount and relevant details, approve via Platform API, complete via Platform API, and grant value only after successful server completion. Recover incomplete payments. | Existing approve/complete routes and incomplete-payment recovery exist. Phase 23 hardens client initialization, amount precision, memo bounds, and reserved metadata. | Run Testnet purchase, cancellation, insufficient Pi, callback retries, amount/metadata tampering, network mismatch, duplicate completion, and incomplete-payment recovery. Verify no fulfillment on failed completion. |
| A2U payment | A2U uses server credentials and current user wallet information, and must handle transaction submission/completion/recovery carefully. Current official advanced guide says A2U is Testnet-only. The official `pi-apps/pi-nodejs` repository publishes the `pi-backend` npm package and identifies Pi Core Team authorship. | A2U adapter uses the Pi Core Team-supported Node.js package `pi-backend@0.1.3`, published from `pi-apps/pi-nodejs`, but its transitive lock graph is incomplete and its live Testnet behavior has not been verified. | Keep `PI_A2U_ENABLED=false` until the dependency lock is refreshed, clean install/build pass, and full Testnet transfer/recovery tests pass. |
| Rewarded ads | Never reward based only on a client callback; verify `adId` with Platform API and require `mediator_ack_status === "granted"`. Ads monetization requires Core Team approval; check `ad_network` support. | Source contains legacy SDKLite ad interfaces; this review does not certify their current runtime or server verification. | Audit each ad path end-to-end; confirm server-side ad status verification, no client-only rewards, feature availability checks, and monetization approval. Keep monetization/reward flags disabled if evidence is missing. |
| In-app notifications | Requires `in_app_notifications` scope and server-only Platform API. | Not certified in this review. | Verify scope consent and server-side API-key use if enabled. Do not expose API key in client code. |
| PiNet | App must be eligible/listed and registered through Developer Portal; registered PiNet URL/domain must be used. | Metadata and app code cannot establish listing/eligibility or ownership of the deployed PiNet URL. | Verify the exact GreenHaven PiNet URL in Developer Portal, HTTPS/domain validation, redirects, origins, and all external links. |
| Wallet/seed phrases | Never request a user's wallet seed phrase. Use approved Pi SDK/platform flows and explicit consent. | No seed-phrase entry is part of the intended GreenHaven design; source review does not constitute a full UI/runtime proof. | Search rendered screens and all form inputs for seed-phrase/private-key collection. Test links against lookalike wallet domains. |
| Tokens | Core Team token tutorial is explicitly Testnet guidance; do not present app-issued GHC as a Pi Network native token or imply Mainnet token issuance without actual authorized on-chain implementation. | GreenHaven GHC is an internal app ledger asset, separate from PI. Existing project rules prohibit automatic GHC↔PI conversion. | Ensure every wallet, membership, reward, seller and legal UI clearly distinguishes PI from GHC and never implies unsupported redemption/conversion. |
| Developer terms | Use is subject to Pi Network Developer Terms of Use; licensing/terms should be reviewed for SDK and app use. | This repository review is not a legal interpretation and cannot accept terms on the owner's behalf. | App owner must review/accept current Developer Terms in the Developer Portal and verify app content/policies before submission. |

## Phase 23 source changes

- The root layout continues to load the official Pi JS SDK from the Core Team URL.
- `ensurePiInitialized()` no longer treats a missing `Pi.init` method as success.
- Script-load races wait on the already-present SDK script rather than inserting a duplicate copy.
- U2A payment startup fails closed if SDK initialization fails; it does not call `createPayment` after a swallowed init error.
- U2A input amount is finite, positive and limited to seven decimal places; memo is bounded.
- Caller metadata cannot override the app identity, engine, or server-created intent ID.
- The Pi A2U implementation uses the Core Team-maintained `pi-backend` SDK but remains gated until the lock graph and live Testnet behavior are verified.

## Release gates — do not skip

1. Confirm app network and URL in Developer Portal. Testnet and Mainnet require separate registered app/configuration; a runtime flag cannot change the registered app network.
2. Use separate environment variables and separate Supabase projects for Preview/Testnet and Production/Mainnet. Confirm API keys belong to the matching registered app.
3. Refresh and commit a complete lockfile on supported Node/npm; then run clean install, typecheck, lint, all static tests and production build.
4. Run the full Pi Browser Testnet checklist, including incomplete-payment recovery and duplicate callback cases.
5. Audit ads/rewarded-ad flows against the current Platform API and Core Team monetization approval status.
6. Verify PiNet registration, domain validation, terms, privacy policy, and the exact deployed app URL.
7. Keep A2U, GHC settlement, NGN bank payout and any reward monetization flags off until the relevant external and database evidence is recorded.

**Bottom line:** Phase 23 improves conformity and closes a concrete client-side SDK initialization gap. It does not certify GreenHaven with Pi Core Team, prove Developer Portal configuration, or replace live Pi Browser/Testnet testing.
