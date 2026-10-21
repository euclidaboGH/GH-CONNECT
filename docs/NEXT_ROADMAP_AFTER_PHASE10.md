# GreenHaven — Roadmap After the Original 10 Phases

**Baseline:** GH-CONNECT 0.63.25 Phase 10 source-gate package  
**Planning rule:** This roadmap does not imply that the Testnet beta or Mainnet release is approved. Complete the release blockers before expanding traffic or enabling higher-risk financial products.

## Track A — Close the release blockers first

1. **Reproducible runtime gate:** use the Phase 9–10 evidence packet to track a clean install on Node 24.15.0, dependency audit, TypeScript, lint, production build, and complete `ci:verify`; resolve every failure before moving on. The local environment must first switch from unsupported Node 22.16.0.
2. **Remote environment attestation:** verify Preview/Testnet and Production/Mainnet separation, credentials by network label, domains, and readiness output without exposing secrets.
3. **Migration safety:** reconcile each remote migration history independently, review dependency ordering and destructive changes, replay on a disposable database, then apply only an explicitly approved Testnet migration set.
4. **Live multi-account E2E:** Pi Testnet authentication, account isolation/IDOR, profile and social visibility, private media, DMs, receipts, reconnects, notifications and session expiry.
5. **Financial reconciliation:** provider sandbox payment lifecycle, duplicate callbacks, concurrency, abandoned/failed intent recovery, membership entitlement, refund/reversal and ledger invariants.
6. **Recovery and observability:** restore rehearsal, rollback/forward-recovery plan, tested kill switches, redacted logs, alert routing, incident owner and operational dashboards.
7. **Controlled beta approval:** validate the complete, hash-verified Testnet evidence packet; define cohort, success/error thresholds, monitoring window, support path, rollback trigger and independent signed approval. Keep Mainnet as a separate decision.

## Track B — Product quality and trust

8. **End-to-end social reliability:** multi-account tests for posts, comments/replies, reactions, rosters, stories, groups, DMs, notifications and cross-device hydration.
9. **Media lifecycle:** upload limits, metadata normalization, malware/content policy hooks where applicable, private media authorization, expiry, deletion and orphan cleanup.
10. **Accessibility and device acceptance:** screen reader/keyboard review, Pi Browser and Android browser testing, narrow-screen/tablet/desktop visual QA, reduced-motion and network-loss states.
11. **Discovery and ranking quality:** explicit ranking signals, fairness and privacy review, abuse-resistance, explainable recommendations and offline/empty-state UX.
12. **Performance budgets:** Core Web Vitals, route latency, database query budgets, feed pagination, image delivery, bundle-size budgets and slow-network testing.

## Track C — Operations, governance and scale

13. **Data lifecycle governance:** retention/deletion policy, export/recovery workflows, consent and audit trails, access reviews and incident handling.
14. **Abuse and reputation safety:** coordinated-account detection with corroborating signals, appeal path, correction-safe reputation settlement and independent reviewer thresholds; keep unproven scoring disabled.
15. **Financial product gates:** separate approvals for GHC conversion, Pi-funded acquisition, seller payouts, Paystack payouts, and any new monetization route.
16. **Resilience engineering:** rate limits, bounded retries, circuit-breaker decisions for provider calls, queue/backlog observability, idempotent recovery and disaster-recovery exercises.
17. **Release automation:** reviewed pull requests, immutable artifacts, migration previews, staged rollout and automatic blocking on critical quality/security regressions.
18. **Mainnet change review:** only after Testnet evidence, restore rehearsal, finance/security review, policy/legal review where needed, and accountable sign-off.

## Prioritization policy

- P0: security, authorization, privacy, data integrity, payment correctness, release/runtime failures.
- P1: cross-account product correctness, recovery, observability and accessibility blockers.
- P2: performance, usability, discovery quality and adoption improvements.
- P3: new monetization and expansion only after their policy, finance and security gates pass.

Every track should produce implementation diffs, automated regression tests, a report of what was actually executed, and a list of remaining external gates. Never report a planned task as implemented, or source assertions as proof of live production behavior.
