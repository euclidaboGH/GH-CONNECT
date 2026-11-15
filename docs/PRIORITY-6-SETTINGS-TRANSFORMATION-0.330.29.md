# Priority 6 — Settings Transformation 0.330.29

## Audit findings

The existing Settings screen already had distinct routes for account/economy, privacy and safety, device lock, preferences, notifications, appearance, performance, support and legal controls. Replacing those routes would have duplicated existing authorities and increased regression risk. The higher-value gaps were the absence of a useful overview of the controls already configured and the use of whole render-time settings snapshots for individual changes.

## Delivered

- Added a Settings control-centre overview with privacy posture, enabled notification category count, locale and active appearance summaries.
- Added direct quick navigation to Privacy & Safety, Notifications, Appearance and Language/Discovery settings.
- Changed toggle and selection handlers to submit narrow partial patches. Independent rapid changes no longer carry unrelated stale fields from the render snapshot.
- Changed theme mode, preset and custom-image updates to narrow patches.
- Bounded discovery radius to 1–100 and age inputs to 18–80 while maintaining `ageMin <= ageMax`.
- Kept messaging privacy on its authenticated server endpoint and all other preferences on the existing state persistence lane.
- Added a dedicated Priority 6 regression contract and registered it in `prebuild` and `verify:static`.

## Boundaries

- No new settings API, privacy authority, notification-delivery promise or permission grant was introduced.
- Browser notification permission is still requested only after an explicit user action.
- Location remains optional and device/session-scoped as before.
- No migrations, payment actions, wallet/ledger changes or membership entitlement changes.

## Acceptance still required

- Node 24.15.x dependency install, typecheck, ESLint and production build.
- Browser/Android/Pi Browser testing for settings navigation, back behavior, accessibility and preference persistence.
- Cross-session and account-switch validation for settings storage and server-backed messaging privacy.
- Live Testnet acceptance where server-backed privacy preferences are involved.

**Release status: NOT APPROVED for production until the project-wide external gates pass.**
