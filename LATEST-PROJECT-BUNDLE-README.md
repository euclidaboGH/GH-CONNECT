# GreenHaven / GH-CONNECT — Full Project Bundle

Baseline: **0.338.55 / RUN295**  
Delivery: **0.338.56 / RUN296 — Onboarding Registration Integrity**  
Bundle date: **2026-11-12**

## Run #296 onboarding and profile registration fixes

- Removed the fake age-18 registration default and require a valid date of birth for adult-age calculation.
- Removed the implicit connection-intent default; users must actively choose their primary mode and at least one connection goal.
- Required server-confirmed profile persistence before moving through registration steps.
- Added durable authenticated profile-photo uploads during onboarding.
- Added server-side required-field validation before Pi identity onboarding completion.
- Prevented local-development fallback from bypassing an explicit incomplete-profile rejection.
- Prevented production onboarding decisions from falling back to stale in-memory profile records when durable reads fail.
- Removed fabricated age/gender/primary-mode defaults from server profile projection.

See `RUN296-ONBOARDING-REGISTRATION-DELIVERY.md` for details and verification limits.

## Preserved Run #295 baseline

The six held migrations (#192, #194, #195, #196, #199 and #216) remain unchanged and classified for review. Their PostgreSQL rehearsal and release gates remain outstanding.

## Verification

- Run #296 onboarding registration integrity contract: PASS (18 assertions).
- Package and lockfile JSON validation: PASS; both report version 0.338.56.
- Full dependency-backed TypeScript, lint, Next.js build and browser E2E are outstanding because this workspace has no installed dependencies and only Node 22.16.0; the project requires Node 24.15.0.

## Safety and release boundary

- No live Supabase/Testnet data or schema was changed.
- No migrations were applied or pushed.
- No GitHub push, Vercel deployment or financial transaction was performed.
- Production remains **NOT APPROVED** pending full CI/build and Pi Browser acceptance.
