> **LEGACY VERIFICATION FIXTURE — HISTORICAL RELEASE RECORD, NOT CURRENT PRODUCT AUTHORITY.**
> Consult `docs/SOURCE_OF_TRUTH.md` and `docs/PROJECT_TRUTH.md` for current authority. Preserve this file for historical traceability only.

# GreenHaven 0.244.0 — Massive Upgrade Pass 22

## Community Participation Outcomes

This release strengthens Communities as a participation engine. The community hub now derives a single useful next action from real visible state: new board attention, active polls, upcoming events, participation activities, community chat attention, or calm exploration when there is no urgent signal.

The experience preserves the product distinction between the Board and live Chat. Polls and challenges remain participation surfaces; no artificial engagement, financial outcome, popularity score, or guaranteed reward is introduced.

### Scope
- Added `buildCommunityOutcome` as a deterministic, data-backed outcome model.
- Added `CommunityOutcomeCard` with accessible action treatment.
- Integrated the outcome card into the community Board.
- Preserved existing events, polls, activities, resources, announcements, moderation and chat systems.
- Preserved canonical navigation: Home · Messages · Communities · Cart · Profile.
- No Supabase migration changes.

### Verification
- Pass 22 gate: 10/10.
- Full production build/typecheck is not claimed in the Node 22 environment; project requires Node 24.15+.
