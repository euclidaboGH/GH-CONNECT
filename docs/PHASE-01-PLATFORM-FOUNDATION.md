# Phase 1 — Platform, Architecture and Security Foundation

## Scope delivered in v0.156.0

This increment establishes a repeatable, network/database-independent foundation gate and wires it into the existing static release verification path. It verifies the repository's Node.js and lockfile contract, runtime preflight hooks, CI runtime/install baseline, TypeScript strictness, global browser security headers, environment-template hygiene, and discoverability of API routes and SQL migrations.

### Verified source contracts

- `.nvmrc`, `package.json` engine range, lockfile root metadata, and package version agree.
- Build, lint, and typecheck preflight scripts enforce the supported Node.js runtime.
- CI selects Node.js 24.15.0 and installs from the lockfile.
- TypeScript strict mode remains enabled.
- Deployment headers retain MIME-sniffing protection, a restrictive referrer policy, one-year HSTS, frame-ancestor policy, and explicit Permissions Policy.
- `.env.example` is a placeholder-only template; it must not contain configured secret values.
- The checker reports API-route and SQL-migration inventory counts without treating file presence as proof of runtime correctness or migration application.

## Verification

Run `npm run check:phase1-platform-foundation` and `npm run verify:static` under the supported Node.js runtime. The foundation check is source-only and requires no network or database.

## Not claimed complete

This is a Phase 1 foundation increment, not completion of all ten Phase 1 roadmap deliverables. It does not prove authorization correctness across every route, production secret-manager configuration, dependency vulnerability remediation, runtime request validation coverage, applied database migrations, TypeScript/build success, penetration testing, or production operational acceptance. Those remain separate evidence-backed work items. No live database, payment, wallet, account, or migration state is changed by this increment.
