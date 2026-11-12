> **LEGACY VERIFICATION FIXTURE — HISTORICAL RELEASE RECORD, NOT CURRENT PRODUCT AUTHORITY.**
> Consult `docs/SOURCE_OF_TRUTH.md` and `docs/PROJECT_TRUTH.md` for current authority. Preserve this file for historical traceability only.

# GreenHaven 0.250.0 — Pass 28

## Trusted Outcome Experience

Pass 28 strengthens the Home outcome layer with explicit evidence context. Recommendations now communicate whether they are confirmed by GreenHaven services, based on the member profile/setup, or derived from current activity. The purpose is to make intelligent assistance more transparent and easier to trust without introducing fake activity, fabricated metrics, or opaque decision-making.

### Product outcome

GreenHaven Home continues to provide one clear next useful action while giving the member a concise explanation of why it is relevant and what evidence informed it. Existing navigation, wallet boundaries, financial authorization, social systems, marketplace controls, membership state, rewards state, and community architecture are preserved.

### Scope

- Added typed evidence classification to cross-feature Home signals.
- Added transparent evidence language to the primary Home action.
- Preserved existing reason/context text.
- Preserved server-authoritative wallet and Daily Claim reads.
- No financial mutations introduced.
- No Supabase migration files changed.
- Migration inventory remains 170 SQL files.

### Verification

- Pass 28 trusted outcome gate: 9/9
- Release hygiene: 11/11
- Regional context: 10/10
- JSX safety: PASS
- Migration source manifest: PASS
- Full production build/typecheck: not claimed in the Node 22 execution environment; project runtime requires Node 24.15.0.
