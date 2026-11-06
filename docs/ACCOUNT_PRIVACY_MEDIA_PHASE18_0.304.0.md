# Phase 18 — Account privacy controls and private-media session isolation

**Release:** 0.304.0  
**Date:** 2026-11-04  
**Status:** Source implementation complete; runtime and operator acceptance pending.

## Private media

- Signed media URLs are bearer credentials and are now cached only inside the active viewer identity/authentication epoch.
- An account or authentication-state change clears cached and in-flight signed URL resolutions.
- User-generated image surfaces across feed posts, comments, profiles, stories, group/community surfaces, discovery, messaging, marketplace previews, creator tools and media retry states use the shared private-media image primitive.
- User-generated video surfaces across posts, comments, profile libraries, Stories, and short-video playback use the shared session-aware video primitive. Native video refs and playback events remain supported.
- Mounted image and video surfaces discard previously resolved playback URLs and resolve the media facade again under the current session.
- A resolution completing after an identity change is rejected rather than cached or returned to the old request context.
- Server-side media authorization and private bucket policy remain authoritative; this client change does not replace authorization.

## Account privacy rights

- Settings → Privacy & Safety includes a downloadable JSON account export.
- The export route retains its explicit table/column allowlist, owner filters, recent step-up requirement, no-store response policy and fail-closed row ceilings.
- The deletion request UI requires a danger confirmation and the exact phrase `DELETE`, then submits an idempotent request to the existing lifecycle RPC.
- The UI clearly states that submission is not immediate deletion. Balances, disputes, payment records and legally required records require review and may need restricted retention.
- No automatic deletion, balance forfeiture, payout, payment or settlement occurs.

## Database and financial scope

No migration was added or changed. No GHC, Pi, wallet, reward, payment, payout, treasury or ledger contract was modified.

## Verification

- Phase 18 source contract: 18/18 passed.
- Phase 18 media-session runtime test: passed (same-viewer cache reuse, account isolation and stale in-flight response rejection).
- Prior consolidated static baseline: 57/57 passed before Phase 18.
- Full consolidated static verification is rerun after integration.
- Node 22.16.0 is available in the audit container, but the project requires Node 24.15.x and dependencies are not installed. Typecheck, lint, production build and browser E2E are not claimed.
- No live Supabase, Pi, Vercel, cross-account browser or production verification is claimed.
