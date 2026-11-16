# Upgrade worklog — 0.330.28

- Baseline: complete 0.330.27 Priority 4 Membership archive.
- Scope: Priority 5 Profile only.
- Audited existing owner profile, public peer profile, professional/business showcase, portfolio sanitizer, profile API privacy projection, social counts, profile deep links and existing regression gates.
- Fixed loss of server-returned professional/business fields during peer-profile hydration.
- Enriched real cached discovery profiles from canonical privacy-projected server data; sample profiles remain local; stale requests are fenced.
- Added shareable profile query deep links and canonical app event resolution.
- Exposed professional/business showcase and durable achievements in owner About.
- Moved authoritative identity snapshot to the main owner profile and removed false zero fallbacks for unavailable metrics.
- Improved tab ARIA relationships.
- Added `check-priority5-profile-transformation.mjs` and wired it into `verify:static` and `prebuild`.
- No migrations, provider calls, financial operations or changes to server-side privacy policy.
- Runtime: Node 22.16.0; required Node 24.15.0. Typecheck/lint/build and browser/device/Testnet acceptance remain open.
