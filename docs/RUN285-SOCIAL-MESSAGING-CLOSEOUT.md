# Run #285 — Social and Messaging Upgrade

## Implemented in source
- Added a server-authoritative durable message-reaction mutation using an allowlisted emoji set.
- Added a per-user/per-message unique reaction table and aggregate-only response contract.
- Added an authenticated PATCH branch for reaction toggles; actor identity is derived from the session, never request JSON.
- Updated the messaging domain to persist reactions through the API when durable messaging is enabled.
- Hydrated aggregate reaction counts and viewer-only selections when older message history is loaded.
- Preserved the local reaction path only for non-production development.
- Added server-only grants and RLS deny-all policy for the reaction table.

## Migration status
`20261111131500_run285_durable_message_reactions.sql` is a migration candidate only. It has NOT been applied to Testnet. The current Testnet ledger contains 39 applied migrations while only 10 exact source files are present in the 0.338.49 archive. Restore and checksum the missing historical sources, then rehearse the full ordered chain on a disposable clean database before applying this candidate.

## Remaining acceptance gates
- Full two-account message reaction/read receipt/edit/delete/retry acceptance.
- Voice/video call browser and mobile acceptance with real Pi Browser/Testnet auth context.
- Node 24.15.0 typecheck, lint, and Next production build.
- Vercel preview build and runtime smoke tests after source synchronization.
- Reconcile all 39 applied Testnet migration sources before any further schema application.
