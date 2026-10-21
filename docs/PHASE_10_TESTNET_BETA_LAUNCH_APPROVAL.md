# Phase 10 — Testnet Beta and Launch Approval

**Project:** GH-CONNECT / GreenHaven 0.63.25  
**Purpose:** Define the evidence required to approve a controlled Testnet beta and keep Mainnet authorization separate.  
**Current decision:** **NOT APPROVED — evidence collection is outstanding.**  
**Remote activity in this source phase:** None. No deployment, migration, credential inspection, or provider call was performed.

## 1. What Phase 10 delivers

- A single release-approval checklist with explicit evidence owners and pass/fail outcomes.
- A fail-closed source test ensuring the release policy remains blocked and financial features remain off until operator evidence is reviewed.
- Explicit separation between source-level regression results, Testnet beta evidence, and a future Mainnet decision.
- A handoff to the next roadmap, focused on completing real environment validation and closing remaining engineering gates.
- A machine-validated evidence packet with required gate IDs, artifact hashes, evidence timestamps, named reviewers, full commit SHA, pinned Node runtime, secret-pattern checks, and an explicit approval decision.
- A dedicated Testnet-only validator: it rejects Mainnet targets, missing evidence, checksum drift, path traversal, unknown gates, unapproved reviewers, and unresolved risks. Template creation refuses to overwrite an existing packet.

## 2. Required gates before a Testnet beta is approved

Every gate must have a dated evidence artifact and a named accountable reviewer. `UNKNOWN`, a missing artifact, a screenshot without context, or a source-only assertion counts as **not passed**.

| Gate | Required evidence | Default status |
|---|---|---|
| Runtime/build | Clean install with Node 24.15.0; typecheck, lint, production build and complete CI verification | BLOCKED |
| Environment isolation | Preview is Testnet; Testnet Supabase and Pi credentials verified; Production remains isolated | BLOCKED |
| Schema/migrations | Remote migration inventory reconciled; reviewed migration diff; clean disposable replay; before/after evidence | BLOCKED |
| Authentication | Two separate Pi Testnet accounts sign in and resume sessions correctly | BLOCKED |
| Authorization/privacy | A/B IDOR tests for wallet, profile, messages, private media, saved content and account-specific resources | BLOCKED |
| Financial integrity | Idempotent duplicate/replay/concurrency tests, provider state reconciliation, no client-authoritative settlement | BLOCKED |
| Social/realtime | Cross-account post/comment/reaction visibility, message delivery/read/presence and reconnect tests | BLOCKED |
| Media | Authenticated private media access, expiry, unauthorized viewer denial, upload failure/retry and deletion behavior | BLOCKED |
| Recovery | Isolated backup restore rehearsal, migration recovery plan, kill-switch test and rollback rehearsal | BLOCKED |
| Observability | Health/readiness output, redacted logs, error monitoring, alert owner and incident contacts verified | BLOCKED |
| Product acceptance | Android/Pi Browser, narrow mobile, tablet and desktop smoke review; accessibility and error states | BLOCKED |
| Approval | Dated engineering, security, operations and finance/product sign-off for the Testnet beta scope | BLOCKED |

## 3. Evidence protocol

Use `docs/evidence/README.md` and `docs/evidence/testnet-beta-evidence.template.json` as the machine-checkable evidence packet contract. Create a separate working packet with `npm run release:evidence:template`; attach sanitized artifacts and record their SHA-256 hashes; then run `npm run release:evidence:validate`. The committed template intentionally remains blocked. A validator pass checks packet completeness and artifact integrity, not the truth of the evidence, so reviewers must inspect the artifacts independently.

Use `docs/ops/PHASE7_LIVE_TESTNET_OPERATOR_PROTOCOL.md` and `docs/TESTNET_LIVE_RELEASE_GATES.md` as the operator procedures. Execute only against the designated Preview deployment and dedicated Testnet project. Reconcile migration history before applying any SQL. Do not run production E2E commands, and do not set `GHC_E2E_ALLOW_PRODUCTION=1` for this work.

Evidence packet should contain:

- commit SHA, package version, Node/npm versions, and deployment/build identifier;
- sanitized outputs for clean install, typecheck, lint, build, and `ci:verify`;
- environment attestation that records network labels and project references, never secrets;
- migration inventory and reviewed before/after status;
- two-account authentication and authorization results, including expected and actual HTTP status codes;
- Pi Testnet payment identifiers and provider reconciliation outcomes where payment tests are enabled;
- messaging, social, media and responsive-device smoke results;
- restore/rollback rehearsal result, incident contact and feature kill-switch result;
- named reviewers, decision, date and unresolved risks.

Never attach session cookies, service-role keys, API secrets, JWTs, passwords, payment payloads containing personal data, or unnecessary wallet/user identifiers.

## 4. Approval rules

- Static/source tests do not substitute for deployed behavior.
- A successful login or one successful payment does not prove cross-account isolation, idempotency, refunds, recovery or provider reconciliation.
- No Mainnet credentials, production migrations or live financial features are authorized by this Phase 10 document.
- Mainnet requires a separate review after Testnet evidence is complete, with separate environment attestation and explicit approval. The Testnet evidence validator deliberately refuses Mainnet targets.
- Keep Pi-funded GHC acquisition, seller payouts, bank payouts, and other high-risk financial flows disabled unless their own release gates and policy approvals are complete.
- Do not erase or rewrite ledger history to fix a failed test. Use reviewed compensating/recovery procedures.

## 5. Source-level verification of the approval controls

| Suite | Result |
|---|---:|
| Phase 10 beta gate assertions | 18/18 passed |
| Release evidence validator tests, including CLI behavior | 22/22 passed |
| Phase 9 operations/resilience assertions | 19/19 passed |
| Project integrity audit | 36 passed, 0 errors, 0 warnings |
| Dependency-lock consistency | Passed |
| JSX safety | 710 files scanned, passed |

These tests prove that the local policy and validator behave as asserted. They do not provide live Testnet evidence or authorize a release.

## 6. Current gate status

**Decision: NOT APPROVED.** The current local source archive passes selected source-level suites, but a clean dependency install, full TypeScript/lint/build run under the pinned runtime, remote migration reconciliation, live Pi Testnet flows, multi-account authorization tests, provider sandbox reconciliation, and restore rehearsal have not been established in this work. No deployment has been performed.

## 7. Phase 10 exit

Phase 10 source-side gate design and regression coverage are delivered. The **Testnet beta itself is not approved** until the required evidence is collected and reviewed by the responsible operator. The next roadmap starts with completing these external gates, then proceeds to the subsequent reliability, scale and product evolution tracks.
