# GreenHaven reputation, social activity, and anti-abuse policy

## Two-component reputation model (target policy)

Reputation is not wallet balance. The long-term reputation/ranking score is designed as **80% quality and reputable system activity, 20% social interaction**. The 80% component includes verified useful contributions, trustworthy completed platform activity, and settled curation accuracy. The 20% component includes eligible social participation. The 20% share is a ceiling on the social component, not a promise that every click earns points. The application must calculate the split from server-owned evidence; client-submitted totals/ranks are never authoritative.

## Eligible signals and safeguards

- Verified content creation and quality: score useful, original content using settled outcomes and abuse checks; raw post count is not enough.
- Accurate curation: only settled judgments can contribute; require confidence >= 75, at least five distinct eligible reviewers, exclude the content author and self-curation, and use an idempotency key per reviewer/content. Unresolved/protected settlements do not award accuracy points.
- Social interactions: eligible comments/replies and community participation can count with per-day caps and diminishing returns; likes, follows, repeated comments, and reciprocal rings alone must not create unlimited progress.
- Presence, videos, and ads: only server-confirmed, minimum-duration/visibility-qualified events may be considered. Heartbeats are deduplicated, watch time is capped, ad rewards require provider confirmation, and background tabs/bots do not accrue unlimited points. Do not award points merely for being online or repeatedly replaying an ad.
- Self-curation is allowed for encouragement/display and count integrity, but it does not count as independent validation and cannot mint GHC or reputation by itself.
- GHC rewards are a separate ledger. A reputation award never creates GHC; a GHC reward does not automatically create reputation.

## Progressive ranks

The 15 rank thresholds rise progressively: 0, 25, 100, 250, 500, 900, 1,500, 2,400, 3,700, 5,500, 8,000, 11,500, 16,000, 22,000, 30,000. These are cumulative reputation points; upper levels require substantially more progress than early levels. Server SQL and TypeScript metadata must use the same values.

## Settlement, corrections, and audit

Curation accuracy must not be converted into reputation until the settlement engine can atomically write both the settled judgment and a reputation event. Events must be idempotent and source-linked. Corrections must use explicit compensating ledger events and recompute derived totals; never edit historical events or silently reverse GHC. Until signed compensating reputation events are available and tested, settled-curation reputation awards remain gated off rather than risking unrecoverable over-credit.

## Allocation and abuse response

Privileged allocation must derive reputation, calibration, eligibility, and risk status on the server; apply documented per-account/per-period limits; and ignore client-supplied rank, wallet balance, or reward amount. Add risk signals for account creation bursts, shared device/network fingerprints where lawful and disclosed, reciprocal curation rings, repeated content/reward targets, and unusual video/ad patterns. Signals should trigger throttling/review, not automatic irreversible punishment. Provide an appeal path and audit trail.

## Rollout gate

Apply migrations to Testnet first. Run multi-account collusion, self-curation, duplicate/replayed activity, timezone boundary, concurrent settlement, correction/compensation, and daily-cap tests before any production release. Migration files and static tests do not prove live database state or successful deployment.

## Compatibility invariants

Raw upvotes/downvotes do not award or deduct account-reputation points immediately. Settled judgment quality is reflected in curator calibration and can affect curation influence separately from account reputation. GHPV settlement never mints GHC. Wallet balance must not grant voting influence. A changed percentage does not reverse, claw back, or add a second credit to an already-posted GHC ledger entry. Testnet only: validate migrations and all abuse cases before considering production.
