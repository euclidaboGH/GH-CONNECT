# Upgrade worklog — 0.271.4

## TypeScript typecheck repair (CI)

- `pi-payout-authorization-card.tsx`: narrow `body` before property access (`body && body.ok !== false`).
- `settings.tsx`: add `"pi-payout-auth"` to `SettingsSection` union.
- `privacy-controls.ts`: add optional `locationPrivacy` on `PrivacySettingsSlice` for privacy-health.

Document date: 2026-11-01.
Supported runtime: Node.js 24.15.0.

Source-level / source-only verification only; inventory is not applied-state evidence. Runtime typecheck confirmed via CI after push.
