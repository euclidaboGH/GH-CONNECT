# Upgrade worklog — 0.330.30

## Scope

Priority 7 — Communities: discovery, participation and governance transformation.

## Audit findings

- The community action-center Board, Chat and Requests tiles all applied the same generic unread sort; they did not focus the corresponding community subset.
- The optional governance mirror feature flag could make the durability label say “Server-backed” even though the API mirror explicitly returns `durable:false` until the reviewed persistence migration and write/read implementation exist.
- Legacy community event rows without provider IDs received a fresh random identifier on every normalization, creating unstable render identity.
- Community resource URLs were passed through without protocol validation; malformed resource rows could also fail during ordering normalization.

## Changes

- Added independent, toggleable Board, Chat and moderator Requests focus filters to the community pulse, including selected-state semantics and a clear-focus action.
- Role matching for request focus recognizes identity aliases.
- Governance durability now remains `session` until durable server persistence is actually implemented and confirmed. Enabling the optional mirror no longer implies server durability.
- Event fallback IDs are deterministic and stable for the same legacy row/order; event time, attendee counts, title and description are bounded/validated.
- Community event/resource links now allow HTTPS URLs and safe same-origin relative paths only; unsafe protocols, protocol-relative links and malformed values are rejected both in domain normalization and at the rendered card boundary.
- Resource normalization now tolerates missing rows and invalid sort-order values.
- Added and registered Priority 7 source and runtime regression gates.

## Safety boundary

No migration was added or applied. No membership/join, chat governance, moderation decision, role, report-review, wallet, GHC, Pi, payment, ledger, reward, payout or entitlement authority changed. Session-only governance remains explicitly non-durable; the feature flag is not treated as proof of persistence.

## Verification

Targeted Community source and runtime contracts are run in this increment. Existing community discovery, membership shell, outcomes and global-standard contracts remain required. Dependency-backed TypeScript/ESLint/Next.js build, browser/device, live database and Testnet/operator acceptance still require Node 24.15.x and the supported external environment. Production is NOT APPROVED.

This is **source-only verification**. The required supported runtime is Node.js `24.15.0`; the available audit runtime in this workspace is Node.js `22.16.0`, so dependency-backed typecheck, ESLint and the Next.js production build have not been run.
Supported build runtime: Node.js 24.15.0.
