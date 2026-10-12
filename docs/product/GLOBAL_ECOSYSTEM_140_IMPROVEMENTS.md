# GreenHaven Global Ecosystem — 140-Point Product and Engineering Upgrade Blueprint

**Status:** Product specification and implementation checklist. This document is not a claim that every item is already implemented or production-verified.

**Follow-up review:** See [`GLOBAL_ECOSYSTEM_140_REVIEW_AND_INTEGRATION.md`](./GLOBAL_ECOSYSTEM_140_REVIEW_AND_INTEGRATION.md) for source findings, resolved cross-area conflicts, a durable feed-curation implementation, and release gates.

## North-star principles

1. **One source of truth:** financial and trust-sensitive state is derived and enforced server-side.
2. **Connected but bounded:** rewards, curation, ranking, progression, growth, reputation, and marketplace exchange events through explicit contracts; no circular or unbounded incentive loops.
3. **Safety before scale:** authorization, privacy, anti-abuse controls, appeals, auditability, and operational kill switches are release requirements.
4. **Explainable outcomes:** users can understand why a reward is pending, why content appears, how progression is earned, and what a marketplace order status means.
5. **Measured rollout:** every material change has tests, observability, a staged rollout, and rollback criteria.

## Shared architecture required across all seven areas

- **Identity and authorization:** derive actor identity from the authenticated session; check ownership and current state on every mutation.
- **Domain events:** define versioned events such as `reward.eligible`, `curation.feedback_recorded`, `ranking.impression`, `progression.xp_awarded`, `reputation.review_verified`, and `marketplace.order_transitioned`. Persist event IDs and deduplicate retries.
- **Ledger and audit:** financial effects are append-only entries with explicit reversal links; non-financial reputation/progression changes retain provenance and moderation history.
- **Policy engine:** centralize limits, eligibility, region/category rules, risk holds, and feature flags rather than duplicating logic across UI components.
- **Data contracts:** typed request/response schemas, database constraints, explicit state machines, pagination, and stable error codes.
- **Observability:** structured metrics and alerts for abuse, failures, latency, stuck states, imbalance, conversion, user harm, and support burden.
- **Testing:** unit tests for formulas, integration tests for authorization and state transitions, property/concurrency tests for money and inventory, and end-to-end tests for critical user journeys.
- **Privacy:** data minimization, retention limits, export/delete workflows where applicable, and no use of sensitive personal attributes as hidden ranking shortcuts.

## Implementation order

### P0 — integrity and launch blockers

1. Reconcile existing migrations and production schema before introducing new tables or constraints.
2. Verify server-side authorization, atomicity, idempotency, and immutable audit trails for rewards, payments, inventory, and order state.
3. Ensure privacy filters run before ranking and are applied consistently across feeds, search, stories, recommendations, and marketplace surfaces.
4. Add abuse caps, risk holds, appeals, alerting, and emergency kill switches to value-dispensing and high-impact workflows.
5. Pass typecheck, lint, build, authorization tests, concurrency tests, migration dry-run/reconciliation, and payment-provider sandbox E2E.

### P1 — connected product capabilities

6. Ship the shared event contracts and common user-facing status language.
7. Connect reward explanations, progression, reputation badges, creator analytics, and marketplace seller trust to verified source events.
8. Persist curation preferences and use them in server-side candidate filtering/reranking.
9. Introduce versioned ranking and progression rules with experiment guardrails and rollback.
10. Complete order lifecycle, refund/dispute paths, and seller operations before scaling marketplace acquisition.

### P2 — optimization and global expansion

11. Evaluate ranking with quality/diversity/safety metrics, not engagement alone.
12. Localize onboarding, moderation, payments, marketplace policies, and support processes per launch market.
13. Conduct independent security, privacy, fairness, accessibility, and abuse reviews.
14. Use gradual cohort rollout with documented success and rollback thresholds.

## 140 improvements by area

## Rewards and wallet integrity (20 improvements)
1. Canonical double-entry ledger for every credit, debit, hold, reversal, fee, and settlement; never treat a client balance as authoritative.
2. Explicit reward lifecycle: estimated → pending → eligible → available → paid, or held/reversed with a reason.
3. Idempotent reward event keys and database uniqueness constraints so retries cannot mint duplicate rewards.
4. Atomic reward posting with transaction boundaries and concurrency tests for simultaneous claims, tips, and payouts.
5. Published reward formula versioning, effective dates, and change history; old events retain the formula that created them.
6. Separate spendable, pending, reserved, locked, and lifetime-earned balances with clear explanations.
7. Per-action, per-day, per-account, and ecosystem-wide issuance limits with configurable circuit breakers.
8. Fraud/risk holds and an appeal workflow; no silent balance edits by support staff.
9. Immutable audit trail for reward source, calculation inputs, actor, timestamps, and reversal linkage.
10. User-readable transaction receipts with event ID, status, source, fees, and expected settlement timing.
11. Reward eligibility checks for self-voting, self-tipping, reciprocal rings, duplicate accounts, and suspicious velocity.
12. Anti-wash-trading and anti-sybil controls before rewardable actions become eligible.
13. Clear separation between promotional points, utility credits, creator rewards, and any cash/crypto-like value.
14. Currency and unit precision policy; integer minor units or explicit decimal rules, never floating-point money math.
15. Withdrawal readiness checklist: identity/eligibility, minimums, limits, fees, supported jurisdictions, and status tracking.
16. Payment-provider reconciliation against server-verified transaction status, expected amount, currency, and order ID.
17. Durable webhook deduplication and safe recovery for late, duplicate, and out-of-order provider events.
18. User export and dispute path for wallet history, with privacy-preserving data minimization.
19. Operational alerts for ledger imbalance, unusual issuance, negative balances, failed settlement, and stuck holds.
20. Feature flags, staged rollout, kill switches, and rollback procedures for every economy rule change.

## Curation and feed quality (20 improvements)
1. Independent post-actions menu and curation menu, with labels that explain their different scopes.
2. Explicit controls: show less, show more, mute author, mute topic, snooze, block, report, and reset preferences.
3. Explain-why-this-post cards using understandable reasons without exposing exploitable ranking weights.
4. User-selectable feed modes such as Following, For You, Latest, Communities, and Saved.
5. Negative feedback must be persisted server-side and affect subsequent feed retrieval, not just dismiss a card locally.
6. Preference controls for language, topic, media type, creator size, and content intensity.
7. Diversity constraints to prevent one author, topic, or community from dominating a session.
8. Relevance decay and freshness logic with configurable and testable rules.
9. Deduplication across reposts, cross-posts, and near-identical content.
10. Low-quality and spam downranking separated from safety enforcement and transparent to moderators.
11. Accessible keyboard and screen-reader flows for all curation actions and action sheets.
12. Undo affordances for reversible feed controls and clear confirmation for destructive account-level actions.
13. Feedback abuse protection so coordinated groups cannot cheaply bury legitimate creators.
14. Cold-start onboarding that asks optional interests and updates from actual user choices.
15. Content warnings and user controls for sensitive topics, autoplay, and media intensity.
16. Creator controls for audience, comments, quote/repost permissions, and reward eligibility.
17. Feed response observability: latency, empty-feed rate, repeat rate, hides, reports, and meaningful engagement.
18. Offline/error states that preserve user intent and never claim a preference was saved before server confirmation.
19. Privacy-safe experimentation with opt-out where required and no sensitive-attribute inference for ranking.
20. Golden feed tests for block/mute enforcement, privacy boundaries, ranking diversity, and abuse resistance.

## Ranking and discovery (20 improvements)
1. Documented ranking objective balancing relevance, freshness, relationship strength, quality, diversity, and safety.
2. Separate candidate retrieval, eligibility filtering, scoring, reranking, and final feed assembly stages.
3. Hard exclusion rules for blocked users, private content, deleted content, and audience-restricted posts.
4. Quality signals that favor meaningful reading, helpful replies, and trusted community contribution over raw clicks.
5. Cap the influence of likes, reposts, and high-follower accounts to reduce popularity lock-in.
6. Rate-limit and detect engagement bursts, bot-like patterns, coordinated voting, and reciprocal rings.
7. Apply creator and topic diversity caps within a feed window.
8. Freshness decay that adapts by content type rather than one universal time formula.
9. New-creator exploration budget with guardrails and feedback loops to avoid permanent incumbency.
10. Personalization based on explicit and observed preferences with a visible reset control.
11. Ranking explanations that reveal broad factors without disclosing anti-abuse thresholds.
12. Per-user and per-community ranking configuration that can evolve without client releases.
13. Experiment assignment that is stable, privacy-aware, and logged for reproducibility.
14. Offline evaluation dataset with relevance, diversity, novelty, fairness, and safety metrics.
15. Online monitoring for dwell quality, hides, reports, unfollows, session satisfaction, and creator reach concentration.
16. Protect against reward-driven ranking loops by separating reward eligibility from raw distribution score.
17. Handle multilingual and regional relevance without assuming one global culture or language.
18. Freshness and source credibility signals for news-like or high-impact content, with appeal for mistakes.
19. Fail-safe fallback ranking when scoring or feature services fail; never bypass privacy filters.
20. Versioned score components and rollback switch for each ranking model/rule set.

## Levels and progression (20 improvements)
1. Publish a level framework tied to contribution quality, consistency, learning, and community service—not just activity volume.
2. Separate XP/progression from spendable wallet value to prevent level farming from creating money liabilities.
3. Anti-farming diminishing returns for repetitive low-value actions and reciprocal engagement loops.
4. Explicit XP event ledger with idempotency, event provenance, and reversal support.
5. Level thresholds and reward rules versioned so changes do not silently invalidate earned progress.
6. Multiple contribution paths: creator, curator, mentor, community builder, seller, and trusted participant.
7. Level-up milestones with useful unlocks rather than pay-to-win ranking advantages.
8. Progress dashboard showing next milestone, qualifying actions, and realistic progress estimates.
9. Caps and cooldowns on repeated actions that award progression.
10. No XP for deleted, fraudulent, self-generated, or policy-violating activity after review.
11. Graceful handling of moderation reversals and disputed actions.
12. Beginner-friendly starter goals that do not require public posting or oversharing.
13. Opt-in celebrations with reduced-motion and notification controls.
14. Level badges accessible to assistive technology and not dependent on color alone.
15. Seasonal challenges with published rules, deadlines, eligibility, and prize allocation.
16. Fairness review across new users, low-bandwidth users, languages, and different contribution styles.
17. Progression API shared across profile, community, creator studio, and rewards centre.
18. Admin preview and simulation of level-rule changes before deployment.
19. Analytics for level distribution, time-to-progress, abandonment, and suspicious concentration.
20. Automated tests proving XP cannot be duplicated, forged by clients, or granted without eligible server events.

## Growth and sustainable expansion (20 improvements)
1. Consent-based referral program with verified milestones and transparent reward conditions.
2. Anti-self-referral and referral-ring detection using privacy-minimized risk signals.
3. Invite attribution that is durable, auditable, and resistant to parameter tampering.
4. Onboarding journey personalized by declared goals and optional interests.
5. Activation metrics focused on meaningful connections and retained value, not signup counts alone.
6. Community growth tools: invite links, role-aware onboarding, welcome sequences, and community health dashboards.
7. Creator growth analytics for reach, saves, meaningful replies, returning audience, and conversion.
8. Growth loops that reward helpful introductions and successful community participation rather than spam.
9. Rate limits and abuse controls on invitations, follows, DMs, mentions, and bulk actions.
10. Localized onboarding, currencies/units where applicable, language preferences, and regional policy handling.
11. Low-bandwidth mode, media quality controls, and resilient uploads for emerging-market connectivity.
12. Accessibility-first onboarding with save-and-resume and clear validation errors.
13. Email/push/in-app lifecycle messaging with consent, frequency caps, and quiet hours.
14. Referral dashboards that clearly distinguish pending, qualified, rejected, and paid referrals.
15. Experiment framework with guardrail metrics for spam, reports, churn, and support load.
16. Growth attribution that respects consent and data minimization; no covert fingerprinting.
17. Partner and organization onboarding with verified ownership and delegated access.
18. Abuse-aware rate limits for viral content, trending topics, and high-volume account actions.
19. Churn prevention through user-controlled reminders and useful re-engagement, not manipulative dark patterns.
20. Growth scorecards measuring retained relationships, creator sustainability, community health, and trust.

## Reputation and trust (20 improvements)
1. Separate reputation dimensions for helpfulness, reliability, safety, expertise, and transaction trust.
2. No single opaque score should determine all privileges; show contextual badges and evidence categories.
3. Reputation events must be attributable to verified actions and resistant to client-side spoofing.
4. Weight feedback by transaction or interaction validity, with caps against review brigading.
5. Protect against retaliation with delayed, blind, or structured reviews where appropriate.
6. Allow users to contest incorrect penalties and see status, reason category, and resolution path.
7. Distinguish allegations, automated flags, confirmed violations, and resolved appeals.
8. Use time decay carefully so old mistakes can be rehabilitated without erasing serious safety history.
9. Never expose private reports, sensitive reporter identity, or hidden anti-abuse signals.
10. Contextual trust indicators for sellers, creators, moderators, and community organizers.
11. Identity verification is a claim with scope and date, not a blanket guarantee of honesty.
12. New-user trust ramp with proportional limits that can be earned through safe participation.
13. Risk-based step-up checks for high-impact actions, payouts, and account recovery.
14. Protect reputation from purchased engagement, fake testimonials, and reciprocal review rings.
15. Appeal and moderation decisions should be logged with reviewer permissions and conflict-of-interest checks.
16. Clear community guidelines and explainable enforcement ladders.
17. Privacy-safe trust signals with retention limits and access controls.
18. Trust dashboard for account security, verification, transaction history, and community standing.
19. Periodic bias and disparate-impact audits across language, geography, account age, and creator size.
20. Automated tests for self-review, duplicate review, brigading, reputation reset abuse, and unauthorized score changes.

## Marketplace and commerce (20 improvements)
1. Server-authoritative listing price, currency, inventory, discounts, tax/fees, and checkout total.
2. Listing lifecycle state machine: draft, pending review, active, reserved, sold, paused, removed, and disputed.
3. Atomic inventory reservation with expiry and concurrency safety to prevent double-selling.
4. Orders with explicit states, immutable line-item snapshots, and transition authorization.
5. Payment verification on the server against provider, order ID, amount, and currency before fulfillment.
6. Idempotent payment webhooks and fulfillment to prevent duplicate order completion.
7. Buyer and seller protection with clear eligibility, evidence requirements, timelines, and escalation.
8. Escrow or delayed settlement only where legally and operationally supported; never imply protection that is not implemented.
9. Cancellation, refunds, partial refunds, returns, and chargeback workflows with ledger-linked reversals.
10. Seller verification and risk tiers proportionate to transaction volume and category risk.
11. Listing moderation for prohibited goods, counterfeit claims, scams, misleading photos, and unsafe services.
12. Search facets for category, location, condition, price, delivery/pickup, seller trust, and availability.
13. Product variants, stock quantities, shipping options, delivery estimates, and clear fulfillment responsibilities.
14. Buyer/seller messaging tied to orders with privacy and anti-phishing protections.
15. Reviews only after eligible transactions or verified service interactions, with anti-brigading controls.
16. Fee disclosure before checkout, including taxes, shipping, currency conversion, and refund treatment.
17. Localized address, delivery, payment, and consumer-protection rules by launch market.
18. Seller analytics for conversion, returns, dispute rate, stock velocity, and net proceeds.
19. Fraud monitoring for account takeover, stolen payment methods, triangulation, refund abuse, and suspicious velocity.
20. Operational dashboards, reconciliation jobs, support tooling, audit trails, and marketplace kill switches.

## Launch acceptance gates

- [ ] No client-provided balance, XP, reputation score, listing price, payment status, or eligibility flag is trusted as authoritative.
- [ ] Duplicate requests and provider retries cannot duplicate credits, XP, reviews, order fulfillment, or inventory changes.
- [ ] Concurrent claims, payouts, reservations, and purchases preserve invariants under load.
- [ ] Every mutation is authorized against the authenticated actor, resource owner, and current workflow state.
- [ ] Feed ranking never overrides blocks, privacy, moderation, or audience restrictions.
- [ ] Reward and marketplace formulas are versioned, explainable, observable, and reversible through explicit compensating events.
- [ ] Users have appropriate reporting, appeal, dispute, and transaction-history paths.
- [ ] Monitoring and on-call runbooks exist for ledger imbalance, payment mismatch, abuse spikes, stuck orders, and ranking incidents.
- [ ] Automated tests pass in CI and live-provider sandbox tests confirm end-to-end behavior.
- [ ] Migration changes are reviewed against both Testnet and Mainnet state; no blind production push.

## Security references

- OWASP Business Logic Security Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html
- OWASP Third Party Payment Gateway Integration Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Third_Party_Payment_Gateway_Integration_Cheat_Sheet.html
- OWASP Webhook Security Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Webhook_Security_Cheat_Sheet.html

These references support server-side derivation of trusted values, atomic handling of concurrent operations, authorization at each transition, payment verification, webhook authenticity, and durable duplicate-event handling. They do not certify GreenHaven itself; project-specific verification is still required.
