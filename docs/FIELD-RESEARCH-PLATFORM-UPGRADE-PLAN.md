# GreenHaven Field Research — platform transformation plan

**Baseline:** `GREENHAVEN-0.338.87-FIELD-RESEARCH-FOUNDATION-2026-11-16.zip`  
**Current implementation:** `0.338.89` Research Studio, conditional branching & Research Intelligence schema foundation  
**Scope:** Field Research, Challenge-on-Post, and Polls-on-Post  
**Status:** Owner-facing visual authoring, public share links, anonymous browser responses, consent capture, durable response storage and private owner inbox are implemented. Basic previous-question conditional branching is now implemented in the visual editor and server submission validator. Release 0.338.89 adds REVIEW_REQUIRED additive schema foundations for evidence metadata, team roles, configurable geography, election contests/candidates/agent assignments/tallies, timed exam attempts, durable challenge participation/events, poll policy settings and audit history. Media upload-to-response integration, verified Nigeria reference-data import, full election workflows, exam runtime/scoring, advanced analytics and the full Challenge/Poll product transformations remain staged work. This document is a delivery contract, not a claim that all 90 upgrades are already shipped.

## Product direction

Field Research is a research and data-collection platform, not merely a field-agent text form. It has two distinct surfaces:

- **Research Studio (authenticated owner):** create, configure, preview, publish, share, close, analyse, export, and archive a project.
- **Public Response Portal (browser-accessible):** respondents open a share link without a GreenHaven account or Pi Browser, subject to the project's publication and response controls.
- **Field Agent Portal (scoped access):** code-authorized agents submit structured observations and evidence without receiving a GreenHaven account, wallet, or admin session.
- **Research Inbox (owner/operator):** durable response review, moderation, evidence verification, exports, and audit history.

The public response capability must never imply that an anonymous response is a verified person, an official vote, or an authenticated election result. Election observation is an evidence and reporting workflow; it is not an online voting system or a substitute for an election authority's official process.

## Field Research — 30 upgrade tracks

1. **Research Studio dashboard:** project list, drafts, published, paused, closed, and archived views.
2. **Guided project creation:** survey, examination, field study, election observation, registration, feedback, and custom templates.
3. **Visual form builder:** reorderable sections and questions with preview-first authoring.
4. **Question type library:** short/long text, single/multiple choice, dropdown, rating, date/time, number, location, matrix, file, image, audio, and video.
5. **Conditional logic:** show/hide questions and sections using validated rule trees.
6. **Validation rules:** required fields, ranges, formats, answer limits, and cross-field checks.
7. **Examination mode:** timed attempts, question pools, randomized order, attempt limits, scoring rules, and result release controls.
8. **Public share links:** opaque, revocable project links with optional expiry and response limits.
9. **Anonymous and identified modes:** clear consent and identity disclosure before response collection.
10. **Respondent access controls:** public, link-only, code-gated, invited, or authenticated modes.
11. **Mobile-first response experience:** low-bandwidth layouts, progress, save/resume where safe, and accessible controls.
12. **Multilingual forms:** per-project language variants and locale-aware formatting.
13. **Geographic hierarchy builder:** country, state/province, district/zone, LGA/county, ward, polling unit, and configurable local levels.
14. **Election observation templates:** contest, office, candidate/party roster, polling unit, opening/closing, turnout observations, incidents, and tally transcription.
15. **Structured tally capture:** candidate rows, vote counts, rejected/void ballots, total ballots, reconciliation checks, and discrepancy flags.
16. **Agent assignment:** project roles, region/ward/unit assignment, scoped permissions, and revocation.
17. **Evidence attachments:** images, video, audio, PDF, and document uploads through controlled storage policies.
18. **Evidence metadata:** upload time, uploader/session, project, question, location context, checksum, and review status.
19. **Duplicate and abuse controls:** idempotency, rate limits, bot friction, duplicate heuristics, and anomaly queues.
20. **Response lifecycle:** received, pending review, verified, flagged, rejected, corrected, and withdrawn states.
21. **Owner response inbox:** filters, search, geographic drill-down, assignment, bulk review, and case notes.
22. **Analytics dashboard:** counts, completion, distributions, trends, cross-tabs, and geography breakdowns with sample-size warnings.
23. **Live operations view:** response velocity and regional coverage without presenting unverified submissions as confirmed facts.
24. **Exports and integrations:** CSV/XLSX/JSON and documented API export with permission checks and audit logs.
25. **Notifications:** owner alerts, in-app inbox routing, digest controls, and deduplication.
26. **Collaboration:** co-owners, editors, reviewers, enumerators, and read-only analysts with least privilege.
27. **Consent and privacy:** purpose notice, data minimization, sensitive-field warnings, retention, deletion, and respondent rights.
28. **Audit and provenance:** append-only event history for publishing, changes, response review, exports, and privileged access.
29. **Reliability and recovery:** multi-instance durable storage, upload retry, idempotent submission, backup/restore, and migration rehearsal.
30. **Global readiness:** localization, accessibility, timezone support, low-bandwidth operation, threat review, load testing, and staged release gates.

## Challenge-on-Post — 30 upgrade tracks

1. Structured challenge entity separate from decorative post text.
2. Challenge categories and reusable templates.
3. Clear objective, measurable success criteria, and completion evidence.
4. Start/end scheduling with timezone-safe boundaries.
5. Join/leave lifecycle and capacity controls.
6. Public, followers, community, invite-only, and private visibility.
7. Eligibility rules and age/safety restrictions where applicable.
8. Individual, team, and community challenge modes.
9. Milestones and multi-step progress.
10. Server-authoritative progress events; no client-only completion claims.
11. Evidence submissions with moderation and review states.
12. Anti-cheat, replay, duplicate-event, and collusion controls.
13. Challenge owner/moderator roles and permission checks.
14. Participant roster with privacy controls.
15. Progress dashboard and meaningful activity timeline.
16. Reminders and notification preferences.
17. Comments and discussion scoped to challenge participation.
18. Shareable challenge landing pages and deep links.
19. Discovery, search, category filters, and ranking transparency.
20. Draft, preview, publish, pause, cancel, complete, and archive states.
21. Edit rules with participant notification and change history.
22. Accessibility and localized content.
23. Offline draft handling with safe reconnect and idempotency.
24. Report, block, moderation, appeal, and safeguarding workflow.
25. Reward integration only through existing authoritative reward validation.
26. Reward disclosure, eligibility, limits, and non-financial challenge support.
27. Analytics for joins, retention, milestone completion, and drop-off.
28. Exportable owner reports with privacy-safe aggregation.
29. Reliability, observability, abuse metrics, and operator tooling.
30. Automated acceptance, security, regression, and staged-release gates.

## Polls-on-Post — 30 upgrade tracks

1. Canonical poll entity linked to its post, not text-parsed poll metadata.
2. Single-choice, multiple-choice, ranked, rating, and opinion-scale formats.
3. Draft, scheduled, open, paused, closed, and archived lifecycle.
4. Server-enforced opening and closing timestamps.
5. Configurable anonymous or attributable voting with clear disclosure.
6. One-vote and change-vote policies enforced server-side.
7. Multi-select limits and strict option validation.
8. Optional write-in answers with moderation and abuse controls.
9. Audience targeting: public, followers, community, or invited participants.
10. Eligibility rules and account integrity checks.
11. Shareable poll links and deep links.
12. Real-time result refresh with privacy thresholds.
13. Results visibility before vote, after vote, after close, or owner-only.
14. Sample-size and uncertainty context; avoid overstated representativeness.
15. Geographic segmentation only when respondents knowingly provide valid region data.
16. Election-related poll disclaimer separating opinion polls from official voting.
17. Anti-bot and rate-limit controls.
18. Idempotent vote submission and duplicate/replay protection.
19. Transaction-safe vote counting and concurrency tests.
20. Edit restrictions after first vote and transparent change history.
21. Poll moderation, report, hide, and appeal workflows.
22. Accessibility, keyboard navigation, and screen-reader labels.
23. Localization and timezone-aware scheduling.
24. Mobile-first interaction and low-bandwidth behavior.
25. Poll analytics for response rate, option distribution, and completion.
26. Export controls with privacy and authorization checks.
27. Owner collaboration and moderator permissions.
28. Notification preferences for poll launch, close, and results.
29. Observability, recovery, abuse monitoring, and operational dashboards.
30. Automated security, integrity, load, and release-readiness tests.

## Audit findings: existing Challenge and Poll experiences

The source review found materially different maturity levels. Release 0.338.89 now makes new Challenge-on-Post creation and joining durable through a dedicated server API; older local-only challenge posts are deliberately not treated as authoritative or joinable. This is an initial lifecycle slice, not completion of the 30-track programme: server-verified progress, milestones, evidence review, capacity, collaboration, moderation, analytics and reward controls still remain.

- **Poll composer:** creates a durable poll through `/api/social/polls` before publishing a feed reference. This is the correct direction for canonical poll identity. The composer also keeps a browser-local cache; that cache must remain a convenience only, never the source of truth for votes or results. Continue auditing vote lifecycle, visibility, concurrency, eligibility, and privacy at the API/database boundary.
- **Challenge composer:** publishes a formatted post and creates a challenge identifier/progress record in `localStorage`. The source comment explicitly describes a local progress track. This is not yet a durable, globally synchronized challenge system. A challenge can appear in the feed while its locally stored tracking data is absent on another device. Do not represent local progress as server-verified completion or issue rewards from this client state.
- **Shared post architecture:** existing canonical post rendering and interaction checks are already present. Preserve that shared renderer rather than creating separate post-card implementations for polls or challenges.

The 30-track programmes below are the upgrade requirements for each feature; they are not 30 completed code changes. The highest-priority implementation gap is moving Challenge identity, participation, progress events, and evidence to server-authoritative durable records, while preserving the already-durable poll creation path.

## Current implementation notes

- `/field` remains a public browser route and is now branded as **Field Research** with clearer navigation and an agent workspace overview.
- Field Research is listed in the GreenHaven Ecosystem under **Research & Intelligence**.
- The existing access-code verifier now accepts 4–128 character codes, allowing the requested numeric codes (`1000` through `10000`). Hashes are still compared using SHA-256 plus timing-safe equality.
- Field session signing now requires the dedicated `GHC_FIELD_SESSION_SECRET`; it no longer silently reuses the app auth/JWT secret.
- Existing field intake is still text-only and the built-in survey catalog is environment-configured. A full owner form builder, public anonymous response endpoint, media uploads, and analytics are not yet implemented.
- The SQL proposal `supabase/proposals/20261116160000_gh_field_reports.sql` remains a proposal pending Testnet operator review and migration-state verification. Do not apply blindly or replay it if already applied.

## Preview environment setup

Set these in the existing Vercel project's **Preview** environment only. Do not commit secrets or put them in client-exposed `NEXT_PUBLIC_*` variables.

```bash
# Preferred: SHA-256 hex digests for the ten requested codes
GHC_FIELD_ACCESS_CODE_HASHES=<comma-separated SHA-256 digests>

# Remove/leave unset when using hashes
# GHC_FIELD_ACCESS_CODES=

# Generate a dedicated secret locally; store the output only in Vercel Preview
openssl rand -base64 48
GHC_FIELD_SESSION_SECRET=<generated-output>

# Optional: authenticated GreenHaven account identifier for future in-app routing
GHC_FIELD_ADMIN_USER_ID=<GreenHaven-user-id>
```

Generate each digest locally with `printf %s '1000' | openssl dgst -sha256` (repeat for each code). The supplied codes are short, sequential shared secrets. Hashing does **not** increase their entropy; use them only for controlled Preview/testing, keep the endpoint rate-limited, and replace them with individually issued high-entropy codes before production or election-critical use.

## Testnet durability and notification rollout

1. Inspect the Testnet migration ledger and `supabase/proposals/20261116160000_gh_field_reports.sql` together.
2. Confirm the proposal is not already applied; inspect dependencies, RLS, function ACL, and rollback/recovery expectations.
3. Apply through the existing approved Testnet migration workflow only after operator review.
4. Verify multi-instance insert/read behavior, timeout behavior, and duplicate submission behavior.
5. Only then route reports to the GreenHaven central inbox. Notification delivery is supplemental; the durable report record remains the source of truth.
6. Do not treat a successful in-app notification as proof that a report was durably stored.
