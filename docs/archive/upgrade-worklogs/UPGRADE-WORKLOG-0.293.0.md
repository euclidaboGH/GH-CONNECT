# Upgrade Worklog — 0.293.0

## Phase 6 — workflow localisation and translation governance
Added typed workflow translation messages for post composition, profile editing, community board orientation, marketplace listing forms and the wallet transaction-history heading. Wired the selected regional locale into the actual screens while preserving English fallback and existing domain operations. Added a native-speaker review governance contract with catalog-version binding, reviewer identity, review timestamp and product-owner approval requirements. Added static regression coverage and release documentation.

## Verification and limitations
Source-level checks are included in the release. TypeScript, lint, production build and browser E2E must be run under the required Node.js 24.15.0 runtime. No production approval is implied. Hausa, Igbo, Yoruba and Nigerian Pidgin remain partial preview packs; all need native-speaker and product-owner review. No database, authentication, wallet ledger, Pi payment or financial logic was changed.
