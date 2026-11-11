# Upgrade worklog — 0.338.12

## Baseline and scope

- Working baseline: `GREENHAVEN-0.338.11-MESSENGER-COMMUNITY-TRANSFORMATION.zip`.
- Original user-authoritative input remains `GREENHAVEN-0.338.9-RESPONSIVE-UI-MARKETPLACE-COMMUNITY.zip`; 0.338.10–0.338.12 are derived working increments.
- Started Priority 10 Phase 1 immediately.

## Implemented

- Added a conversation-information control to the active chat header.
- Added an accessible information-centre dialog with conversation type, available participant count, loaded message/media counts, last activity, privacy/safety boundary, profile navigation and shared-media navigation.
- Added Escape-to-close and explicit dismissal.
- Added the four-phase/35-workstream execution plan, research references, source capability audit, release ledger and security gates.
- Kept unimplemented durable preferences and workflows explicitly out of the active controls; no mock persistence.
- No SQL migration, payment code, auth bypass, RLS relaxation, privileged RPC or external service credential was introduced.

## Validation

- Run `node scripts/check-priority10-phase1.mjs`.
- Run the existing Priority 10, Priority 9 messaging, repository consistency and documentation hygiene checks.
- Full dependency-backed typecheck/lint/build, live Supabase/Testnet, two-account authorization, and browser/device verification remain outstanding because this extracted workspace has no `node_modules` and the project requires Node 24.15.0.

## Status

Phase 1 has started; it is not complete. This release delivers the information-centre foundation and the implementation plan/audit record. Search backend, edit/pin, durable preferences, contact sharing and group creation require further Phase 1 work.
