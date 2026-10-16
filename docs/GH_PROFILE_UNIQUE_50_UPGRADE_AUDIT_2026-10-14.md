# GH-CONNECT — Unique Profile Experience & 50-Point Production Audit

Date: 2026-10-14  
Branch target: `testnet`  
Scope: profile, profile dashboard, timeline, social graph, stories, composer, content library, messaging, rewards, curation, reputation, wallet, access control, media, database and release verification.

## Product direction: GreenHaven should not clone Facebook

GreenHaven's profile should work as a **member identity + personal timeline + relationship control surface**. The differentiated model is:

- **Profile = identity and authored posts.** Keep the main page focused on identity, relationship actions, stories, and the owner's canonical post timeline. Avoid a wall of unrelated account tools.
- **Dashboard = operations centre.** Wallet, rewards, membership, creator tools, communities, account setup and settings live in a separate full-screen destination.
- **Relationship lists are navigable data, not decorative counts.** Posts, Friends, Following and Followers open independent list views; list entries open the relevant post/profile when the underlying identifier is available.
- **One publishing pipeline.** Profile and Home invoke the same create hub so post validation, media upload, visibility, moderation and rewards rules are not duplicated.
- **Trust-first growth.** Rewards, ranking and reputation should be derived from server-verified events and explainable signals; client UI must never mint balances or assert unverified rewards.
- **Privacy by default.** Profile visibility, blocks, archived/deleted content and relationship restrictions must be enforced by server queries, not merely hidden in the UI.

## Changes made in this pass

1. Removed the inline `dashboardOpen` disclosure wrapper that had been wrapping unrelated profile sections. It could make identity/community/interests/checklist content behave as a Dashboard extension instead of independent profile content.
2. Kept the Dashboard as a dedicated full-screen dialog with its own close control.
3. Moved My Communities, account setup checklist and More Account Tools into the independent Dashboard, preserving those capabilities while reducing profile noise.
4. Made social-list rows actionable when a stable ID is available: post rows route to Home with post context; member rows dispatch the existing peer-profile event.
5. Avoided pretending an opaque identifier is a display name; unidentified records use a neutral “GreenHaven member” label.
6. Updated profile audit assertions to verify the new independent Dashboard model rather than the superseded inline disclosure design.
7. Preserved the previous profile media library, durable media guards, story validation/rate limits, messaging rate limits, and Vercel video-element TypeScript fix.

## 50-point safe-upgrade audit

Legend: **PASS** = static check passed in this workspace; **WIRED** = code path is present but requires live-account confirmation; **OPERATOR** = cannot be certified without installed dependencies, live services, or an authorized deployment/database.

### Profile and identity
1. PASS — Owner timeline uses the canonical feed/post card implementation.
2. PASS — Owner post list is filtered by stable author identity before display.
3. PASS — Profile completion prompts remain actionable and do not replace the timeline.
4. PASS — GreenHaven public ID remains visible and copy action awaits clipboard result.
5. PASS — Edit-profile persistence reports success/failure and prevents duplicate saves.
6. PASS — Profile and cover photo history is bounded.
7. PASS — Photo upload has MIME and byte-size checks.
8. PASS — Profile content library separates Posts, Photos, Videos, Documents and History.
9. PASS — Library search and pagination are bounded and abort stale requests.
10. WIRED — Profile previews resolve through the app's existing peer-profile event; test a member not already in discovery candidates.

### Navigation and social graph
11. PASS — Posts, Friends, Following and Followers counts are actionable buttons.
12. PASS — Each count opens its own modal list.
13. PASS — Member rows invoke peer-profile navigation when a stable ID exists.
14. PASS — Post rows carry post context into Home when a stable post ID exists.
15. PASS — Unknown IDs are not presented as verified names.
16. OPERATOR — Confirm graph arrays contain canonical user IDs or hydrated member records in production.
17. OPERATOR — Confirm follower list is server-derived and not a partial local cache.
18. OPERATOR — Confirm friend list represents accepted mutual relationships, not outgoing requests.
19. PASS — Dashboard opens as a distinct full-screen destination.
20. PASS — Communities, account setup and more account tools are grouped under Dashboard rather than cluttering the profile timeline.

### Stories and publishing
21. PASS — Profile story strip is positioned near the identity/social actions.
22. PASS — Profile story surface reuses the shared story component.
23. PASS — Story creation requires authenticated server identity.
24. PASS — Story create/list routes have rate limits and no-store responses.
25. PASS — Story body length and request size are bounded.
26. PASS — Story media URL validation rejects unsafe schemes and credentials.
27. PASS — Video posts/stories avoid persisting temporary blob URLs.
28. PASS — Profile and Home use the same create hub event.
29. OPERATOR — Publish text, image and video from both surfaces using a real account and confirm identical audience/validation behavior.
30. OPERATOR — Confirm story expiry, viewer receipts and audience enforcement against the live database/RPC.

### Timeline, curation and reputation
31. PASS — Canonical post actions support edit, delete, archive, save, like and context-aware comment/share/insights.
32. PASS — Content library includes media-bearing posts in the Posts timeline.
33. PASS — Curation endpoint requires authenticated access and rate limiting.
34. PASS — Reputation endpoint requires authenticated access and rate limiting.
35. PASS — Client profile updates exclude client-controlled financial fields.
36. OPERATOR — Verify curation weights, abuse resistance, ranking freshness and explainability against production data.
37. OPERATOR — Confirm reputation changes are generated only by authoritative server-side events.
38. OPERATOR — Confirm deleted/blocked/hidden content is excluded from ranking and recommendations.
39. OPERATOR — Confirm reward calculations cannot be triggered by duplicate client retries.
40. OPERATOR — Confirm moderation/appeal outcomes affect ranking only according to documented policy.

### Wallet, membership and security
41. PASS — Wallet API enforces authenticated same-user access.
42. PASS — Rewards claim and daily reward routes require authentication.
43. PASS — Membership status route requires authentication.
44. PASS — Economy and reward boundaries have static safety suites.
45. PASS — Messaging reads/edits/deletes have per-user rate limits and identifier/body guards.
46. PASS — Media resolver validates IDs, rate limits requests and sets no-store headers.
47. PASS — Upload helper blocks oversized Vercel-proxy uploads instead of silently attempting an unsafe request.
48. OPERATOR — Confirm private/licensed IP is not delivered from public storage without signed access checks.
49. OPERATOR — Apply/reconcile the profile content migration and test RLS/blocks/visibility with multiple real users on Testnet.
50. OPERATOR — Complete clean-install TypeScript, ESLint, Next production build, Pi Browser payment E2E and multi-instance concurrency tests before global launch.

## Verification performed

- JSX safety: 613 files scanned, passed.
- Profile production audit: 87/87 passed.
- Connected profile audit v2: 84/84 passed.
- IDOR static audit: 124 passed, 0 failed (112 routes scanned).
- Social authorization audit: 31 passed, 0 failed.
- Production safety audit: 21 passed, 0 failed.
- Community participation suite: 34 passed, 0 failed.
- Static verification: 11/11 passed.
- Release verification: 30 passed, 0 failed.

## Release limitation — do not interpret static pass as production certification

The release runner explicitly leaves these operator gates open: clean `npm ci --legacy-peer-deps`, `npm run typecheck`, `npm run lint`, `npm run build`, Supabase migration reconciliation, live Test-Pi E2E in Pi Browser and multi-instance concurrency smoke tests. The most recent Vercel log reported that the deployment completed despite an ESLint module-resolution error; a completed deployment is not evidence that lint succeeded. This archive retains the `.js` ESLint config import fix, but the next Vercel log must confirm it loads correctly.

Dependency warnings still require an advisory-led review: unknown npm `cache-dir` config likely comes from the Vercel environment; `isomorphic-dompurify@3.20.0` has a Node compatibility warning; `eslint@9.39.5` is deprecated/out of support; npm reported 12 vulnerabilities; and `unrs-resolver` has an install script awaiting approval. Do not use `npm audit fix --force` as a shortcut. Pin/upgrade dependencies only after checking Vercel's Node version, the actual advisories and lockfile compatibility.
