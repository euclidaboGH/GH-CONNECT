# GH-CONNECT 0.61.7 — Source Upgrade Notes

This repository-only upgrade builds on the uploaded v0.61.6 archive.

- Added viewer-authorized private-media delivery and durable post-media references.
- Added legacy media URL rewrites for records represented in the durable media registry.
- Added provider-verified Pi tip settlement into a creator payable ledger.
- Added PI payout reconciliation and prevented payout status `paid` without confirmed provider evidence.
- Preserved GHC safeguards: no client-trusted credits, no unbacked creator rewards, and no unsupported GHC tip rail.

Deployment is blocked pending review/application of migrations `202610190002_gh_private_media_references_and_viewer_authz.sql` and `202610250004_gh_verified_tip_settlement_payout_reconciliation.sql`, live Testnet verification, and completion of the remaining creator reward funding phase. Do not change the bucket to private before the explicit cutover gate in the Phase 17 document passes.
