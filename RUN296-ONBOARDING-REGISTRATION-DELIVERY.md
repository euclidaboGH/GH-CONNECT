# GreenHaven Run #296 — Onboarding and Profile Registration Integrity

- Baseline: `GREENHAVEN-0.338.55-RUN295-HELD-MIGRATIONS-HARDENED.zip`
- Delivery version: `0.338.56`
- Scope: onboarding form validation, durable profile persistence, profile-photo upload, server-side completion gate and age validation.

## Changes

1. Removed the synthetic age-18 default. Date of birth must be entered and must resolve to a valid adult age; impossible calendar dates are rejected.
2. Removed the implicit Friendship connection-intent default. Users must explicitly select at least one connection goal and a supported primary mode.
3. Registration steps 1–4 advance only after the profile update is confirmed by the server. Offline/local-only queueing is not treated as a successful registration save.
4. Onboarding profile photos are compressed and uploaded through the existing authenticated durable-media pipeline. A local data URL is not accepted as a completed registration photo.
5. Final registration sends all required fields again, then calls the server completion endpoint.
6. The server independently checks display name, age, gender, city, country, primary mode, connection intents, three distinct interests and at least one durable non-placeholder photo before marking the Pi identity complete.
7. An incomplete-profile response (HTTP 422) cannot be bypassed by the local-development auth fallback.
8. Production profile reads fail closed rather than falling back to stale process memory when the database read fails.
9. Incomplete profiles are no longer projected with a fabricated age of 18, gender selection or primary mode.
10. Added `scripts/check-run296-onboarding-registration.mjs` and the `check:run296-onboarding-registration` package script.

## Focused verification

- Run #296 onboarding registration contract: PASS (18 assertions)
- `package.json` and `package-lock.json`: valid JSON; package versions aligned at 0.338.56
- Full ZIP source baseline integrity was checked before extraction.

## Verification limits

- Full TypeScript typecheck, ESLint, Next.js build and browser E2E were not completed in this workspace: dependencies are not installed, the available runtime is Node 22.16.0, and the project requires Node 24.15.0.
- No Supabase schema or live Testnet records were changed. No migrations, GitHub pushes or deployments were performed.
- The six held Run #295 migrations remain held and unchanged.
- Production remains NOT APPROVED pending the project's full Node 24 CI/build and real Pi Browser acceptance.
