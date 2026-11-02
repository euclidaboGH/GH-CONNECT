> Engineering note — 2026-11-02

# Phase 7 continuation — recovery UX and bounded media requests

## Changes

- Component-level error recovery no longer exposes raw exception messages in the user interface. The boundary shows a stable, non-secret diagnostic reference and offers both an in-place retry and a full app reload.
- The root `global-error.tsx` boundary now offers a reload path as well as the Next.js reset action, so users are not trapped in a single retry loop.
- Recovery copy no longer makes an absolute claim that all progress or profile data was preserved; it accurately describes what the error handler does.
- Direct-storage upload timeout errors are surfaced as timeouts instead of being mislabeled as ordinary network failures.
- The phase 7 recovery contract checker is registered with the existing prebuild and static-verification gates.

## Safety boundaries

No authentication requirement, media authorization check, signed-URL policy, payment path, database migration, dependency version, or server-side durability requirement was weakened. The reload action is user-triggered and does not claim the underlying error is fixed. Static contracts do not prove production runtime behavior.

## Required follow-up

Run the supported Node 24.15.0 install, typecheck, lint and production build; exercise Pi Browser uploads against a disposable Testnet/storage environment; verify a signed URL expires and refreshes; and confirm private media remains inaccessible to unauthorized viewers. This source-only pass does not certify those live paths.
