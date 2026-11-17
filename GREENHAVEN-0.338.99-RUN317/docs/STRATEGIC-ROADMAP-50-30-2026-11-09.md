# GREENHAVEN Strategic Upgrade Roadmap — 50 Opportunities / 30 Selected / 3 Phases

**Prepared:** 2026-11-09  
**Audited archive filename:** `GREENHAVEN-0.338.8-wallet-redesign-payout (4).zip`  
**Archive SHA-256:** `4b770c79f4f271a707f65c7e3c58e24d1c01674df5b7c0dccc6eaa1aae630a41`  
**Executable package version:** `0.338.6`  
**Status:** Research and source-compatibility roadmap; no implementation, deployment, database migration, payment, or production approval is implied.

## Executive decision

GreenHaven already has substantial feature breadth and many feature-specific source gates. The next competitive step should not be another large collection of loosely connected features. It should be a controlled programme that makes existing capabilities measurably trustworthy, fast, understandable, safe, and operable at scale.

This roadmap identifies 50 potential improvements and selects the 30 with the strongest combination of user value, safety, compatibility with the current codebase, and ability to verify. The selected 30 are grouped into three implementation phases of ten work packages each:

1. **Trust and platform foundations** — make identity, money, permissions, workflows, data and recovery provably reliable.
2. **Premium product and ecosystem experience** — make the social, community, creator, messaging and commerce journeys coherent and competitive.
3. **Scale, intelligence and global readiness** — make performance, accessibility, localization, observability and releases measurable and sustainable.

The 20 deferred opportunities are not rejected; they should be reconsidered only after demand, operating capacity, compliance and risk justify them.

## Source audit: what exists and what it means

The archive contains a mature Next.js / React application with a modular feature structure and a substantial Supabase-backed server/API layer. The following are direct archive inventory counts, not quality ratings:

| Area | Observed count / state |
|---|---:|
| Next.js API route files | 230 |
| `lib/` files | 521 |
| `features/` files | 34 |
| `components/ghc/` files | 195 |
| Supabase migration SQL files | 198 |
| Engineering scripts (`.mjs` / `.ts`) | 387 |
| Existing maintenance programme | 15 sections × 10 essentials = 150 targets |
| Product roadmap | 11 product priorities |
| Node runtime contract | `^24.15.0` (`.nvmrc` 24.15.0) |
| Package version / current build context | 0.338.6 |
| Next.js | 15.5.26 |
| React | 19.x |

### Existing strengths to preserve

- The architecture is already organized as a modular monolith with feature modules, shared libraries, server APIs and Supabase persistence. **Do not introduce microservices as a default response to file count.**
- Financial writes have server/RPC authority and several fail-closed, idempotency, timeout and reconciliation contracts.
- Pi and GHC are explicitly separate assets and payment rails.
- The marketplace has variant/inventory and fulfilment source work, but its new migration proposals and live payment lifecycle still require acceptance.
- Feed, rewards, membership, identity, messaging, communities, marketplace, filters and notifications already have extensive historical implementation work and static gates.
- Notification remote push remains disabled/not configured; preserve that state until provider, worker, secrets and device acceptance are completed.
- The codebase has an existing 15 × 10 maintenance register and an 11-priority product roadmap. This 50/30 roadmap is an additional cross-cutting strategic programme, not a replacement or a declaration that those registers are complete.

### Baseline and documentation inconsistencies to resolve before release work

1. The uploaded archive filename says **0.338.8**, while its root folder, `package.json`, lockfile and `docs/CURRENT_BUILD_CONTEXT.md` identify **0.338.6**. Treat executable package metadata as the current source release until a deliberate release reconciliation is completed.
2. `docs/SOURCE_OF_TRUTH.md` still labels its current source as **0.330.48** and includes older migration counts. Its header/current-release summary is stale relative to package/build context.
3. The current tree contains **198** migration SQL files. Older documents mention 196, 178 and other historical totals. Reconcile the migration manifest, classification and generated inventory against the actual directory; do not infer that every SQL file has been applied.
4. `package.json` retains the package identifier `gh-connect`. Do not globally rename this blindly: inspect lockfile identity, deployment/project references, scripts, package consumers and compatibility contracts first. User-facing brand remains GreenHaven.
5. Existing records classify migrations as `REVIEW_REQUIRED`, `PROPOSAL` or otherwise held. No roadmap item authorizes applying one. Target database history must be reconciled and migrations rehearsed on disposable PostgreSQL before operator approval.
6. The project’s own acceptance records state that source checks do not prove Node 24 build, live Supabase, Pi Testnet, device, concurrency or operator acceptance. Retain that distinction.

### Recommended architecture direction

Keep the current modular monolith and strengthen its seams incrementally:

- **Domain modules:** one authoritative owner for identity, wallet/ledger, rewards, membership, marketplace orders/inventory, community membership, messaging and notification state.
- **Application services:** orchestrate use cases; do not move business authority into React components or route handlers.
- **Adapters:** isolate Pi Platform API, Supabase/Postgres, storage, email/push and analytics behind typed server-side interfaces.
- **Durable workflow state:** explicit state machines for payment, payout, claims, inventory, order fulfilment, refunds and notification delivery.
- **Transactional outbox:** where external delivery is needed, persist the business transition and outbox event atomically, then deliver with retry, deduplication and dead-letter handling.
- **Read models:** build bounded, owner-scoped read projections for dashboards and activity without making cached projections authoritative for money or entitlements.
- **Contract-first boundaries:** validate inputs, outputs, ownership, state transitions, idempotency and failure semantics at every route/RPC/provider boundary.
- **Incremental extraction only:** extract a module or service only when measured load, independent scaling, fault isolation or team ownership justifies the operational cost.

## Three implementation phases — selected 30

Each work package is a substantial engineering achievement. A package is not complete merely because UI or source code exists. It must meet its acceptance evidence and preserve the release gates.

# Phase I — Trust, financial integrity and platform foundations

**Objective:** eliminate ambiguous authority, reduce account/financial risk, and establish dependable operational controls before adding more growth complexity.

### 1. Canonical domain ownership and contract map
Create a verified architecture map for identity, wallet, rewards, membership, community, marketplace, messaging and notifications. Document each domain’s authoritative tables, RPCs, APIs, client adapters and read models. Detect duplicate writers and shadow authorities. Introduce typed service interfaces only where the audit finds real duplication.  
**Acceptance:** every critical write has one documented authority; no UI-only financial/entitlement writer; architecture dependency checks prevent new cross-domain bypasses.

### 2. Durable workflow state machines and transactional outbox
Standardize explicit state transitions for Pi payments, payouts, GHC transfers, reward claims, membership activation, inventory reservation, order fulfilment and notifications. Add a transactional outbox only where the database can atomically commit the business change and event. Include dedupe keys, retry policy, lease expiry, poison-message/dead-letter review and replay controls.  
**Acceptance:** duplicate, delayed, reordered and interrupted requests cannot create duplicate business effects; replay is auditable and safe.

### 3. Dual-asset ledger integrity and reconciliation centre
Strengthen the financial invariants and build a read-only operator/user explanation layer for available, pending, reserved, locked, withdrawable, settled and reversed states. Keep Pi atomic units and GHC precision separate. Reconcile ledger entries to payout requests, provider IDs, txids and settlement records. Add anomaly reports without silently repairing rows.  
**Acceptance:** property tests prove conservation and valid transitions; orphan reservations and mismatched totals are detected; no client cache is treated as authority; all repairs require reviewed, evidence-backed operator procedures.

### 4. Pi payment and payout lifecycle assurance
Formalize U2A approval/completion and A2U payout workflows against the official Pi Platform API. Verify payer UID, network, amount, direction, payment ID, txid and provider state on the server. Add explicit uncertainty handling, idempotent recovery, operator dual-control for sensitive payout actions, kill switches, Testnet-only drills and immutable audit evidence.  
**Acceptance:** authenticated Testnet end-to-end approval/completion/recovery and payout receipt verification pass; no Mainnet execution until Pi approval, funding, compliance and separate sign-off exist.

### 5. Identity, session and account-recovery hardening
Unify session rotation, revocation, device/session inventory, account switching, step-up authentication, withdrawal PIN setup/recovery, WebAuthn where supported, suspicious login signals and recovery throttles. Ensure PINs are never confused with Pi wallet credentials and are never logged or exposed.  
**Acceptance:** two-account/device tests prove isolation; stolen/revoked sessions fail; recovery cannot bypass step-up or change payout destination without fresh authorization.

### 6. Authorization and data-access verification
Create a systematic API/RPC/RLS matrix for object-level, property-level and function-level authorization. Test every sensitive route with owner, non-owner, anonymous, moderator, admin and service-role contexts. Review storage object ownership, Realtime authorization, exports, search RPCs and privileged functions.  
**Acceptance:** OWASP API Security Top 10 risks are explicitly tested; unauthorized reads/writes fail closed; no service-role credential reaches browser bundles.

### 7. Rewards, referrals and abuse-resistance programme
Threat-model farming, Sybil accounts, referral loops, multi-account claims, scripted engagement, fake transactions, collusion and reward laundering. Combine rate limits with velocity/risk signals, evidence-based eligibility, delayed review for high-risk cases, appeal paths and transparent user messaging. Do not punish solely on opaque scores.  
**Acceptance:** abuse simulations are blocked or queued for review; legitimate users have an appeal/recovery path; all reward issuance remains server-ledger-backed and idempotent.

### 8. Trust, safety and moderation operations
Deliver a coherent moderation console with report queues, severity/priority, evidence retention, case assignment, moderator roles, action history, user notices, appeals and emergency escalation. Add graduated spam/raid controls and configurable community rules. Automated classifiers may flag or queue; consequential enforcement requires policy and human review.  
**Acceptance:** every enforcement action is attributable, scoped, reversible where appropriate and appealable; community moderators cannot exceed their permissions.

### 9. Database and migration governance
Reconcile all 198 SQL files with migration manifests and target histories. Add disposable-PostgreSQL migration rehearsal, forward/rollback or compensating-plan review, schema drift detection, policy/RPC ACL snapshots and data compatibility checks. Require explicit risk classification and approval for destructive or privileged migrations.  
**Acceptance:** clean database bootstrap and upgrade paths are repeatable; migration inventory matches files and target history; held migrations remain unapplied until authorized.

### 10. Backup, restore and incident recovery programme
Define RPO/RTO per domain, encrypted off-site backups, restore-to-new-project drills, object-storage recovery, secret rotation, incident roles, communication templates and post-incident review. Treat wallet/ledger, identity and order records as highest criticality.  
**Acceptance:** timed restore exercises meet approved RPO/RTO; restored data reconciles; operators can recover without overwriting the only live copy.

# Phase II — Premium social product, community and commerce experience

**Objective:** turn the breadth of GreenHaven into a cohesive, low-friction product with differentiated creator, community and commerce journeys.

### 11. Unified premium design system and adaptive app shell
Establish tokens for spacing, typography, surfaces, elevation, motion, controls, density and responsive breakpoints. Standardize compact headers, bottom navigation, content widths, action placement, cards, sheets, dialogs and loading states across Feed, Communities, Marketplace, Messages and Discovery.  
**Acceptance:** design tokens replace one-off styling in priority surfaces; mobile first viewport is content-led; no overlapping headers/navigation; visual regression snapshots cover supported widths.

### 12. Feed quality, relevance and user control
Evolve feed ranking with explicit signals, freshness, relationship strength, topic affinity, content quality, diversity and safety constraints. Add clear “why am I seeing this?”, chronological/following modes, topic controls, mute/block and feedback loops. Do not optimize solely for time spent or outrage.  
**Acceptance:** ranking decisions are explainable at a useful level; user controls change ranking; diversity and quality metrics are monitored; block/mute/visibility rules always override ranking.

### 13. Feed rendering, scrolling and media pipeline
Measure scroll jank, layout shifts, memory, image/video decode, virtualized list stability, pagination and low-end Android/Pi Browser performance. Reserve media dimensions, use bounded prefetch, adaptive media variants, graceful placeholders and stable card geometry. Avoid expensive blur/backdrop filters, scroll-linked animation and large compositing layers on the feed path.  
**Acceptance:** device traces meet agreed frame-time/CLS budgets; long feeds do not leak memory or duplicate posts; reduced-data and slow-network tests remain usable.

### 14. Creator studio and sustainable creator economy
Build a unified creator workspace for drafts, scheduled publishing, audience insights, post performance, portfolio, collaborations and compliant monetization eligibility. Keep rewards and creator payouts transparent, non-guaranteed unless contractually backed, and ledger-authoritative.  
**Acceptance:** creators can manage content and see verifiable metrics; analytics distinguish estimates from settled earnings; monetization rules and eligibility are clear.

### 15. Community governance and healthy participation
Upgrade community creation, onboarding, roles, rules, moderation queues, scheduled events, resources, member reputation and governance proposals. Provide graduated trust controls for new members and configurable community-level safety.  
**Acceptance:** membership and role changes are durable and permission-checked; moderation is auditable; community growth metrics do not reward spam.

### 16. Discovery and matching with consent and explainability
Improve search, recommendations, matching preferences, profile completeness and relevance using user-controlled signals. Keep sensitive attributes out of inference and avoid exposing private profile data. Provide clear reasons and easy controls to reset or tune recommendations.  
**Acceptance:** recommendation results honor privacy, blocks and user preferences; matching is opt-in; ranking is measurable and explainable without revealing private signals.

### 17. Messaging reliability and privacy
Strengthen message send/acknowledgement/delivery/read semantics, retry and deduplication, attachment scanning, conversation membership checks, block/report, retention and account-switch isolation. Make offline send state honest and recoverable.  
**Acceptance:** message ordering and delivery state are consistent under reconnect; no cross-account leakage; abuse and attachment controls are tested.

### 18. Notification delivery and attention controls
Complete durable event-to-notification delivery with grouping, quiet hours, priority, deduplication, per-device subscriptions, revocation and privacy-safe previews. Separate in-app inbox, browser permission and remote push provider acceptance from actual device delivery.  
**Acceptance:** notification state reconciles across devices; no duplicate storms; user controls are respected; remote push remains off until sender/worker/secrets/provider/device tests pass.

### 19. Marketplace trust and seller quality
Build seller verification tiers appropriate to risk, listing quality signals, counterfeit/scam reporting, buyer protection education, seller response metrics and clear delivery/fulfilment expectations. Make trust labels evidence-based and avoid implying regulatory certification.  
**Acceptance:** badges map to verified evidence; seller and listing reports have case workflows; misleading listings and high-risk sellers can be restricted through reviewed processes.

### 20. Commerce lifecycle, disputes and buyer/seller protection
Complete order lifecycle visibility across payment intent, payment verification, inventory, fulfilment, tracking, receipt, cancellation, dispute, refund and seller payout. Model each step distinctly. Do not claim escrow or buyer protection unless legally, technically and operationally implemented.  
**Acceptance:** end-to-end Testnet lifecycle and disposable-Postgres concurrency tests pass; no order is marked paid from a client callback alone; dispute/refund/payout authority is explicit and audited.

# Phase III — Global scale, intelligence and operational excellence

**Objective:** establish measurable service quality and sustainable global readiness, not merely a successful deployment.

### 21. Performance budgets and real-user monitoring
Set route-level budgets for LCP, INP, CLS, JS payload, API latency, feed render time and image bytes. Instrument real-user metrics by device/network/route with privacy-safe sampling. Prioritize low-end Android and constrained networks.  
**Acceptance:** p75 Core Web Vitals targets are met on representative traffic; regressions block staged rollout or trigger rollback.

### 22. OpenTelemetry observability and service-level objectives
Introduce correlated traces, metrics and structured logs across Next.js routes, Supabase calls, Pi provider calls and background workers. Define SLOs and error budgets for login, feed, messaging, checkout, wallet reads and payout state transitions. Redact PII, secrets and financial identifiers.  
**Acceptance:** an operator can trace a failed journey end-to-end with correlation IDs and no sensitive payload leakage; alerts are actionable and tied to runbooks.

### 23. Database/query scale and read-model optimization
Profile real query patterns, indexes, RLS policy costs, connection pools, pagination and hot tables. Add bounded read projections/materialized views only when measured. Protect against N+1 requests, unbounded payloads and expensive global counts.  
**Acceptance:** k6/load tests establish capacity and tail latency; query plans and indexes are evidence-based; no read optimization becomes financial authority.

### 24. Global language, locale, currency and time-zone completion
Complete locale-aware number/date/time formatting, pluralization, currency labels, RTL layouts, locale fallback and translated error/help content. Add a professional translation workflow with native review. Keep Pi and GHC denominations explicit and avoid implying exchange rates where none exist.  
**Acceptance:** end-to-end locale tests cover all supported locales; RTL and long translated strings do not break layouts; translations receive human review.

### 25. Accessibility conformance programme
Target WCAG 2.2 AA across core journeys: keyboard operation, visible/unobscured focus, touch target sizing, contrast, screen-reader names and announcements, error recovery, accessible authentication, reduced motion and captions/transcripts for media.  
**Acceptance:** automated scans plus manual keyboard/screen-reader audits pass on critical journeys; accessibility defects have severity-based release gates.

### 26. Low-bandwidth, offline and device resilience
Provide resilient loading, retry, cache boundaries, background refresh, offline drafts and explicit stale-data labels. Keep sensitive wallet data out of unsafe persistent caches. Test Pi Browser, Android WebView, mobile Safari and desktop browsers.  
**Acceptance:** network loss/reconnect does not duplicate financial actions or lose drafts; stale wallet state is never presented as live authority; supported device matrix is documented.

### 27. Privacy, consent and data lifecycle controls
Create a data inventory and purpose/retention matrix. Provide user-facing privacy controls, export, deletion/deactivation workflows, consent history and data-subject request operations. Define retention for logs, moderation evidence, media, messages and financial records with legal retention exceptions.  
**Acceptance:** data access and deletion requests are auditable; legal/financial retention exceptions are explicit; privacy settings are enforced server-side.

### 28. Responsible recommendation and AI assistance
Use AI only where it has a defined, bounded benefit: spam triage, translation assistance, search assistance, creator tools or support drafting. Keep human review for consequential moderation, account restrictions and financial decisions. Prevent prompt injection, data exfiltration and model output from becoming trusted authority.  
**Acceptance:** evaluations include bias, false positives, privacy, abuse and adversarial inputs; users can appeal or correct high-impact decisions; AI never authorizes money movement.

### 29. Feature flags, experimentation and staged rollout
Add server-controlled flags, cohort rollout, holdouts, kill switches, experiment guardrails and automated rollback. Experiments must not manipulate financial terms, eligibility, safety protections or user consent.  
**Acceptance:** every major release can be rolled out gradually and disabled safely; experiment outcomes include safety/quality guardrails, not only engagement.

### 30. Secure software supply chain and release provenance
Harden CI with pinned actions, least-privilege tokens, secret scanning, dependency review, lockfile integrity, SBOM generation, build provenance/attestation and reproducible release metadata. Add release artifact verification and environment promotion controls.  
**Acceptance:** release artifacts can be traced to reviewed source and workflow; critical dependencies are monitored; provenance verification is part of release approval.

## The 20 additional opportunities — deferred, not in the first 30

These should be considered only after the 30 selected packages have passed their gates and there is clear product demand, risk review and operational capacity.

31. **Live audio/video rooms** — real-time group experiences; requires moderation, recording consent, bandwidth and abuse controls.  
32. **Short-form video creation suite** — creator editing, captions and adaptive transcoding; high storage/CDN and moderation cost.  
33. **Events and ticketing** — event discovery, RSVP, ticket issuance and check-in; requires refund and fraud policies.  
34. **Fundraising and community campaigns** — transparent campaign accounting, beneficiary verification and disbursement controls.  
35. **Charity/grant distribution portal** — eligibility, governance, evidence and audit; requires legal and operational review.  
36. **Business storefront subscriptions** — recurring merchant tools; only after billing, cancellation and tax treatment are established.  
37. **Merchant API and signed webhooks** — partner integration with replay protection, scopes and key rotation.  
38. **Advanced logistics integrations** — carrier rate quotes, labels, pickup networks and proof-of-delivery providers.  
39. **Formal escrow/buyer-protection service** — separate legal, custody, dispute and regulated-activity review before any implementation.  
40. **Regional KYC/AML and sanctions orchestration** — only where legal obligations, risk assessment and licensed provider arrangements require it.  
41. **Additional blockchain networks** — no multi-chain expansion without a security model, custody policy and clear user demand.  
42. **On-chain credentials or reputation proofs** — privacy-preserving proof design; avoid publishing personal or financial behavior.  
43. **Token/NFT collectibles** — only with clear utility, disclosures and jurisdictional review; avoid speculative reward promises.  
44. **Community treasury governance** — voting, proposals and disbursement; requires formal authority, quorum and treasury controls.  
45. **Advanced ad marketplace** — advertiser review, targeting limits, consent and transparent sponsored labeling.  
46. **Learning and skills marketplace** — course publishing, credentials and instructor payouts; requires content and refund policies.  
47. **Jobs and professional services marketplace** — identity verification, scam prevention, dispute and labor-law review.  
48. **Creator collaboration and licensing marketplace** — rights management, contracts, attribution and payment splitting.  
49. **Advanced business intelligence suite** — merchant/creator analytics with privacy thresholds and export controls.  
50. **External identity federation** — additional login providers only after threat-modeling account linking and recovery.

## Delivery method and universal acceptance gates

Every selected work package follows the same controlled sequence:

1. **Audit:** map current code, schemas, API consumers, migrations, user journeys and known production state.
2. **Threat model and design:** write invariants, trust boundaries, abuse cases, failure states, data ownership and rollback plan.
3. **Compatibility review:** identify current canonical routes, RPCs, migrations, feature modules and historical consumers; do not fork authorities.
4. **Implementation:** small, reviewable increments; preserve backward compatibility or supply an explicit migration/adapter plan.
5. **Automated verification:** unit/property/contract/integration tests, static gates, accessibility checks and regression tests.
6. **Disposable infrastructure tests:** PostgreSQL concurrency, migration rehearsal, load tests and provider sandbox tests as appropriate.
7. **Preview/device acceptance:** Node 24.15.x typecheck/lint/build, Vercel Preview, Android/Pi Browser, mobile Safari, desktop, keyboard and screen reader.
8. **Operator acceptance:** Testnet receipts, backup/restore, incident drills and evidence capture where required.
9. **Staged release:** feature flag, small cohort, monitoring, rollback criteria and post-release review.
10. **Bookkeeping:** update source of truth, current build context, worklog, migration inventory, acceptance register and release manifest.

### Non-negotiable safety invariants

- Pi and GHC remain separate assets, units, ledgers and payment rails.
- No client-side minting, balance mutation, payment completion, payout execution, refund, escrow release or entitlement grant.
- Pi U2A requires server-side approval and completion; A2U requires the separate provider/operator controls and approval. A client callback or txid string alone is not proof of settlement.
- Ambiguous provider outcomes remain pending/uncertain and are reconciled against provider evidence.
- No database migration is applied from source inspection alone. Review target history, test on disposable PostgreSQL, classify, obtain explicit approval and preserve recovery.
- No AI score alone can make a consequential account, moderation or financial decision.
- No remote push, Mainnet payout or high-risk feature is enabled by roadmap approval.
- Never claim production readiness from static checks alone.

## Research and standards basis

The roadmap uses public standards and official platform documentation as verification anchors, and studies product patterns rather than copying proprietary implementations:

- **OWASP ASVS 5.0** for web application security requirements and verification: https://asvs.owasp.org/  
- **OWASP API Security Top 10:2023** for object/property/function authorization, resource consumption, sensitive business flows, SSRF, misconfiguration and inventory risks: https://owasp.org/www-project-api-security/  
- **OWASP MASVS / MASTG** for mobile authentication, network, platform, code, resilience and privacy controls: https://mas.owasp.org/  
- **NIST SSDF SP 800-218** for secure development lifecycle and vulnerability reduction: https://csrc.nist.gov/projects/ssdf  
- **W3C WCAG 2.2** for accessible web/mobile experiences: https://www.w3.org/TR/WCAG22/  
- **Google Core Web Vitals**: target p75 LCP ≤ 2.5 s, INP ≤ 200 ms and CLS ≤ 0.1: https://developers.google.com/search/docs/appearance/core-web-vitals  
- **Supabase production security and deployment checklists** for RLS, SSL, network restrictions, auth, threat review, database performance and load testing: https://supabase.com/docs/guides/security/production-checklist and https://supabase.com/docs/guides/deployment/going-into-prod  
- **Supabase backups and PITR** for recovery design and restore drills: https://supabase.com/docs/guides/platform/backups  
- **Pi Platform API** for server-side identity verification, U2A approval/completion and A2U payment flows: https://developers.minepi.com/docs/api-reference/Platform  
- **PostgreSQL transaction isolation** for concurrency and serialization testing: https://www.postgresql.org/docs/current/transaction-iso.html  
- **OpenTelemetry** for vendor-neutral traces, metrics and logs: https://opentelemetry.io/docs/  
- **SLSA and GitHub artifact attestations** for build provenance and supply-chain integrity: https://slsa.dev/ and https://docs.github.com/en/actions/concepts/security/artifact-attestations  
- **Reddit moderation tools** illustrate queues, mod mail, restricted users, mod logs, safety filters and community insights: https://support.reddithelp.com/hc/en-us/articles/15484384020756-Moderation-Tools-overview  
- **Discord AutoMod** illustrates configurable spam/keyword filtering and graduated community safety controls: https://discord.com/safety/auto-moderation-in-discord  

These references are standards and public product documentation, not a claim that GreenHaven has been certified, that competitors use identical internals, or that any third-party platform is risk-free.

## Decision

Proceed with the selected 30 in the stated order. Phase I is the prerequisite for safely expanding high-risk money, identity and moderation workflows. Phase II then improves the product experience without bypassing those authorities. Phase III makes the platform measurable, accessible and scalable. Re-evaluate the deferred 20 only after evidence from real user needs and operating capacity.

**Roadmap status: Proposed and source-compatible at the architecture level; implementation not started by this document. Production remains NOT APPROVED.**
