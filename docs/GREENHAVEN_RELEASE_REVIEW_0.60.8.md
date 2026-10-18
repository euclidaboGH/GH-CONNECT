# GreenHaven release review 0.60.8

Implemented in this source package:
- Reputation levels 1–15 now use progressively harder cumulative point thresholds, synchronized between TypeScript metadata and the SQL level function.
- Creators may self-upvote or self-downvote their own content for encouragement/display. This replaces the prior migration's prohibition. Self-curation must not count as independent reviewer evidence or independently trigger GHC/reputation awards.
- Reputation policy now specifies the target 80% quality/reputable system activity and 20% social interaction mix, with daily caps/diminishing returns, server-verified video/ad/presence evidence, and clear separation between reputation and GHC.
- Migration checklist and Testnet guide document migration 005 as a later override after 004.
- Regression tests cover the updated self-curation policy and progressive rank parity.

Still not complete in this release:
- The settled-curation-to-account-reputation bridge is deliberately gated off. Existing reputation events only support nonnegative points, so a robust correction/compensation mechanism must be implemented before automatically awarding reputation from judgments. This release does not claim that bridge is finished.
- Coordinated-account/shared-identity/collusion detection is not a complete production feature; it requires privacy-reviewed signals, server-side risk aggregation, appeal handling, and multi-account Testnet abuse tests.
- Privileged resource allocation has not been comprehensively migrated to a single server-derived reputation + calibration + eligibility policy.
- The 80/20 model is documented as target policy; this release changes level thresholds but does not yet implement separate persisted 80/20 component scores or the full verified social-activity event pipeline.

Validation performed on source tree: all `scripts/test-*.mjs` passed; reputation/curation integrity 30/30; production safety scan passed; JSX safety scan passed for 640 files. TypeScript, lint, production build, SQL execution, live Supabase integration, Pi Browser E2E, and multi-account abuse testing were not run. No GitHub push, Vercel deployment, or Supabase migration was performed. Mainnet remains untouched.
