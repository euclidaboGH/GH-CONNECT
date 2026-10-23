# Phase 26 — Complete Profile & Identity Platform

## Objective
Converge GreenHaven identity, public profiles, owner profile metrics, social graph, reputation, achievements, privacy and profile navigation around server-authoritative sources.

## Delivered
- Canonical authenticated public-profile endpoint at `/api/social/profile/[userId]`.
- Server-side profile projection strips private economy/membership fields.
- Blocked users cannot resolve one another through the public-profile endpoint.
- Hidden profiles fail closed. `matches-only` also fails closed until a canonical durable match relation exists; no client assertion can bypass this.
- Public identity includes durable follow counts and public reputation trust state.
- Cross-surface `ghc:open-profile` navigation no longer depends on the current Discovery candidate array. Wallet, Activity, Notifications and Messaging can resolve a durable user identity directly.
- Owner Profile gains a server-authoritative Identity & Trust snapshot combining follow graph, reputation and achievements.
- Owner follower/following counters prefer authoritative server counts rather than local context arrays.
- Identity snapshot refreshes after social graph/reputation mutations.
- Existing viewer-authorized profile timeline/media library remains the canonical content path with stable composite pagination and server visibility checks.

## Security model
This phase does not expose wallet balances, membership state or private economy data on public profiles. It does not let clients award reputation or achievements. Public-profile privacy is enforced server-side before projection. `matches-only` is intentionally unavailable to peers until GreenHaven has a canonical durable match proof rather than weakening privacy with client state.

## Verification
`node scripts/test-phase26-profile-identity-platform.mjs` => 14/14 PASS.
Regression contracts for Phase 25, 24, 23, 22, 21 and 20 were also executed where present. No Next.js build/typecheck claim is made because `node_modules` is absent in this packaged workspace.
