# GreenHaven — Four-Phase Recovery, Reliability and Platform Upgrade Plan

Baseline: `GREENHAVEN-0.338.99-RUN320-DEPENDENCY-SECURITY-GUARDRAILS-2026-11-17.zip`

This plan is additive and conservative around money, identity, and data. No Mainnet operation, wallet mutation, PIN change, migration application, or production deployment is authorized by this work plan.

## Phase 1 — Authentication recovery and public-access boundary

**Objective:** Restore reliable Pioneer sign-in behavior without forcing public respondents through Pi authentication.

- Isolate `/r/:slug` and exact `/field` routes from Pi auth, identity/session providers, and global Pi SDK loading.
- Keep `/field/studio`, `/field/admin/**`, wallet, profile, community, and all member surfaces authenticated.
- Preserve official Pi token verification, durable identity/session persistence, rate limits, CSRF/origin checks, and fail-closed behavior.
- Add executable route-policy tests and static regression checks so a future app-shell refactor cannot reintroduce the public-route gate.
- Continue tracing Pioneer sign-in independently: browser SDK load, `Pi.authenticate`, `/api/auth/pi`, Vercel runtime, and Supabase identity/session persistence. Do not infer the Pioneer failure cause from the public-route defect.

**Exit gate:** public route tests pass; authenticated route tests pass; Pi Browser login succeeds on a real Testnet device; returning-user and new-user onboarding complete; no wallet or account regressions.

## Phase 2 — Field Research, public forms and data integrity

**Objective:** Complete the research/field workflows while maintaining strict separation between public respondent access and GreenHaven owner privileges.

- Review all unapplied Field Research migrations against the archive, live Testnet schema, and migration history; classify each as required, duplicate, superseded, or held.
- Complete public survey/exam response validation, access-code field submissions, evidence upload completion, idempotency, rate limits, and durable retry behavior.
- Add school assessment controls: timed windows, attempt limits, randomized question/choice order, autosave, submission receipts, and owner-only grading where applicable.
- Add field-agent assignment scoping, report lifecycle, audit history, and export controls.
- Verify that anonymous respondents cannot read drafts, owner identities, private responses, field-agent records, wallet/economy data, or admin evidence.

**Exit gate:** migration dry-run and RLS review pass; public-browser tests pass without Pi SDK; owner/admin authorization tests pass; duplicate/retry tests pass; no migration is applied until separately approved.

## Phase 3 — Product depth, ecosystem and user experience

**Objective:** Make GreenHaven more capable without activating unfinished financial or privileged modules.

- Upgrade active Feed, Profile, Community, Messages, Marketplace, Filters, Notifications, and Settings based on measurable completeness, accessibility, mobile responsiveness, pagination, and recovery behavior.
- Turn Coming Soon ecosystem items into explicit product specifications and dependency maps; activate only features with complete backend authorization, data contracts, moderation, abuse controls, and support paths.
- Prioritize durable messaging operations, membership-verified full-history search, message settings, read receipts, reactions, editing, pins, contact sharing, group creation, call notifications/history, and community announcements/topics/events/member controls.
- Keep GHC rewards, Pi payments, wallet balances, withdrawals, and membership entitlements outside experimental feature flags unless their own release gates pass.

**Exit gate:** each activated capability has UI, API, database/RLS, abuse controls, tests, monitoring, and rollback; Coming Soon cards remain non-authoritative until complete.

## Phase 4 — Security, performance and release certification

**Objective:** Produce a release candidate with evidence, not just green static checks.

- Triage every dependency advisory by reachability, exploitability, fix availability, and breaking-change risk; patch targeted packages and regenerate/verify the lockfile without blanket upgrades.
- Run typecheck, lint, static contracts, unit tests, safety scans, build, route-level browser tests, and multi-user authorization tests.
- Review migration ordering, duplicate prefixes, forward-only changes, rollback/repair plans, RLS, grants, function search paths, and Testnet/Mainnet divergence.
- Add operational dashboards/alerts for auth success/failure, Pi upstream availability, onboarding completion, public form submissions, rate-limit denials, and wallet authorization failures without logging tokens or sensitive payloads.
- Produce a release manifest with exact commit, archive hash, migration inventory, environment checklist, test evidence, known limitations, and rollback steps.

**Exit gate:** all automated checks pass; Testnet operator acceptance passes; migration plan approved; no unresolved critical/high exploitable dependency issue without an explicit documented exception; only then consider deployment.
