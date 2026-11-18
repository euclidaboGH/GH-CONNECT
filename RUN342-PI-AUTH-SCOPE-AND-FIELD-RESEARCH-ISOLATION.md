# RUN342 — Pi Authentication Scope and Public Field Research Isolation

## Findings from RUN341 source archive

- The root application route (`/`) is intentionally inside the Pi-authenticated shell.
- Public research share links (`/r/:opaqueSlug`) and the exact `/field` desk route are intentionally served by `PublicRouteShell`, which mounts no Pi auth, identity, or session-lock providers.
- `/field/studio` and `/field/admin/**` remain private GreenHaven owner/operator surfaces.
- Public research submissions are server-backed, published-project-only, consent-required, bounded, rate-limited, validated, and idempotent.
- Field-agent reports use a dedicated field-session token and scoped access code; this is not a Pi identity or GreenHaven user session.
- The canonical ecosystem registry marks Coming Soon services as informational (`destination: none`); the server release boundary rejects services that are not ACTIVE/BETA. Existing release-gate tests cover this behavior.

## Change

Ordinary Pi sign-in now requests only the `username` scope. It no longer requests `payments` as part of the baseline login. Wallet permission remains separately requested only in the explicit wallet-consent flow (`wallet_address`). Payment/commerce capabilities remain separate from identity login.

This is a scope-reduction and fault-isolation improvement. It does not prove that the Pi SDK's prior `payments` scope caused the observed `PI_AUTHENTICATE_FAILED`; a live Pi Browser test and Pi SDK diagnostics are still required.

## Release and safety boundaries

- Coming Soon services remain informational and non-interactive.
- Public `/r/:slug` responses and `/field` intake remain Pi-independent.
- Field access remains scoped to field APIs and does not create a GreenHaven account session.
- Pi-funded GHC acquisition, paid business checkout, and other financially sensitive features remain gated.
- No payment, wallet, or database release gate was relaxed.

## Verification

- RUN342 Pi auth scope isolation: 6/6.
- Public route boundary: 12/12.
- Public route policy behavior: 10/10.
- Field Research foundation: 23/23.
- Pi auth reliability: 11/11.
- Ecosystem service registry: 42 services; all checks passed (12 Active, 30 Coming Soon).

A fresh full production build and live Pi Browser authentication test remain required. In particular, verify the Pi Developer Portal's registered app URL matches the origin used for testing; preview deployment hostnames may not be authorized origins.
