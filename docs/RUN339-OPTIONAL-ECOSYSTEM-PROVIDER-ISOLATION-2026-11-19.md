# RUN339 — Optional ecosystem provider isolation

**Package:** 0.338.100  
**Date:** 2026-11-19  
**Scope:** startup dependency isolation and failure containment

## Changes

1. Added `lib/server/ecosystem/optional-provider.ts`. It reuses `getEcosystemServiceAccess` from the existing canonical service-release helper; no competing registry or release policy was introduced.
2. Provider callbacks are invoked only after the canonical release gate allows the service. Provider dynamic imports must be placed inside that callback so an unreleased integration is not imported or initialized.
3. Provider exceptions are caught and mapped to a typed `PROVIDER_FAILURE` result. The helper does not expose raw provider exception details.
4. Removed the ecosystem roadmap screen from authenticated startup prefetch. It remains available for explicit navigation.
5. Startup chunk prefetch is limited to released core surfaces and each import rejection is contained.
6. Realtime transport startup and recovery are best-effort. The app shell and HTTP-backed core services are not made dependent on successful realtime initialization.
7. Added regression checks for blocked unreleased services, successful released providers, provider failure containment, and unknown service rejection.

## Preserved safeguards

- `lib/navigation/service-registry.ts` remains the single service metadata source.
- `lib/server/ecosystem/service-release.ts` remains the canonical server access-control helper.
- Existing Events and Charity release checks remain unchanged.
- Released wallet, marketplace, identity, authentication and core social surfaces were not disabled.
- Existing provider source files remain in the repository for future reviewed activation.

## Important integration rule

This boundary only guarantees isolation for integrations that invoke it. Any provider-specific adapter must keep its import and initialization inside the callback passed to `runOptionalEcosystemProvider`. A top-level static import can initialize a dependency before a runtime gate is evaluated and is therefore prohibited for unreleased providers.

## Verification and limitations

The new runtime regression test is registered in `prebuild:checks` and `verify:static`. Full dependency-backed typecheck, lint and Next production build must still run under the project's required Node 24.15.x runtime with installed dependencies. This packaging environment did not perform a deployment or database operation. Production remains NOT APPROVED pending the existing release gates.
