# GreenHaven 0.338.89 — Research Intelligence Foundation

## Delivered in source

- Added basic declarative conditional question branching to Research Studio. A condition may reference an earlier question only; supported operators are equals, not-equals, contains, numeric greater/less-than, answered and not-answered. The owner editor, public response rendering and server submission validator share the same visibility semantics. Hidden-field values are not accepted by the public API.
- Added an additive, service-role-only schema foundation for project membership roles (owner/editor/reviewer/field_agent), evidence metadata (image/video/audio/document), configurable country-level geographic hierarchies, election contests and candidates, geographic agent assignments, candidate tallies and reconciliation flags, timed examination attempts/results, durable challenge participation/events, poll policy settings, and research audit events.
- Replaced Challenge-on-Post creation and joining from browser-local canonical records with an authenticated API backed by durable challenge and participant tables. New challenge creation requires durable storage; failed post publishing cancels the newly created challenge. Public challenge joins are server-checked for open status and expiry. Legacy challenge posts are explicitly non-joinable rather than pretending local state is authoritative.
- Added a pure election tally reconciliation utility that flags candidate-vote mismatch, ballot-total mismatch, ballots exceeding accredited voters, and accredited voters exceeding registered voters.
- Added automated source-contract and runtime logic checks.

## Security posture

The new tables enable RLS and explicitly revoke table privileges from PUBLIC, anon and authenticated. The migration grants table access only to service_role; application routes must enforce project membership and action-specific roles before using the service credential. Evidence rows store object references and metadata, not public URLs. Storage objects must remain private and be delivered through authorization-checked signed URLs.

## Geographic data boundary

The migration creates a configurable hierarchy and import provenance fields; it does **not** claim that Nigeria's full state/LGA/ward/polling-unit inventory has been imported or independently verified. Open Admin Data’s Nigeria dataset reports 37 states/FCT, 774 LGAs and 8,799 wards, includes coordinates, is licensed CC-BY-4.0 and identifies 2026-06-01 as its last update (`https://github.com/open-admin-data/nigeria-administrative-divisions`). INEC’s public polling-unit page reports 176,846 polling units, 774 LGAs and 8,809 electoral wards (`https://www.inecnigeria.org/polling-units`). The ward counts differ, so they must not be silently merged. Before production import, reconcile the authoritative source and codes with INEC, record attribution/version, validate parent-child integrity, and handle boundary changes explicitly.

## Not yet delivered

- Evidence upload, malware scanning, transcoding, evidence-to-response attachment workflow, metadata extraction and verification UI.
- Full geographic data import, polling-unit master, international data packages and geo-picker UI.
- Election contest/candidate/agent management screens and APIs, tally submission endpoints, source-form evidence binding, supervisor review and aggregation dashboards.
- Examination attempt start/resume, server-clock timer enforcement, question-bank randomization, answer-key scoring, appeals and result release UI.
- Advanced conditional rule groups, nested AND/OR, section branching, computed fields and cross-field validation.
- Complete 30-point Challenge-on-Post and Polls-on-Post product transformations. Challenge creation and join are now durable, but participant progress events, milestones, evidence review, capacity enforcement, invitations, analytics, moderation and reward integrations remain incomplete. Poll settings schema is not yet integrated into the poll RPC or composer; existing social poll vote path remains authoritative.
- Role invitation, acceptance/revocation and granular route-level authorization. The membership schema is not itself an authorization implementation.

## Migration status

`20261116182000_gh_research_intelligence_platform_foundation.sql` is a new additive source migration classified REVIEW_REQUIRED. It has **not** been applied to Testnet or Mainnet. It needs disposable PostgreSQL rehearsal, FK/index/constraint checks, migration-history reconciliation and API authorization integration before Testnet application. The earlier `20261116171144_gh_research_studio_public_forms.sql` remains the only Research Studio schema migration known applied to GH Connect Testnet from the preceding release.

## Verification boundaries

Run `node scripts/check-research-intelligence-foundation.mjs` and `node --disable-warning=ExperimentalWarning --experimental-strip-types scripts/test-research-intelligence-logic.mjs`. Full Next.js production build, browser/device acceptance, storage upload integration and database rehearsal remain separate release gates. No GitHub push, Vercel deployment or Mainnet change is included.
