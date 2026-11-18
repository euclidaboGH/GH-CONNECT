# Phase 30 — Cross-surface interaction reliability (0.330.16)

## Scope delivered

- Notification refreshes now capture the initiating `IdentityService` user ID, use one shared `AbortController` across the four durable notification sources, and reject late responses after an account switch.
- Account changes invalidate the active refresh generation, abort the previous request, clear notification rows/unread counts/durable status and close stale notification detail/thread state.
- A superseded request cannot clear the loading/lock state belonging to a newer refresh. Component cleanup aborts outstanding work.
- Feed, inbox, community and marketplace filter controls expose their selected state through `aria-selected`/`aria-pressed`; marketplace categories are correctly represented as a button group rather than a listbox.
- A source regression gate is registered in both `prebuild` and `verify:static`.

## Preserved product and authority boundaries

- Wallet GHC and Pi remain separate assets and ledgers; no balance or financial authority changed.
- Rewards remain server-authoritative; no client issuance or mission GHC was introduced.
- Membership entitlement remains server-confirmed; no local entitlement shortcut was introduced.
- Messaging persistence, community membership/chat authority, marketplace order/payment transitions, profile privacy, Settings permissions and notification server APIs are unchanged.
- No SQL migration was added or applied.

## Verification boundary

The Phase 30 check validates source contracts and release metadata. The focused existing Settings, Membership, Rewards, Profile, Messaging, Community, Feed, Marketplace and Wallet source gates were run on the uploaded baseline and passed. This environment uses Node 22.16.0 while the repository requires Node 24.15.0; therefore Node 24 typecheck, lint, Next production build, browser/device acceptance and live Supabase/Pi Testnet validation remain outstanding. Production remains NOT APPROVED.
