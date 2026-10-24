# GH-CONNECT / GreenHaven

**Current source version:** `0.89.1` (must match `package.json`, `package-lock.json`, and `lib/app-release.ts`).

GH-CONNECT is a Pi-integrated social, identity, marketplace and GHC utility platform. This repository contains application source, Supabase migrations, automated checks, and operator documentation. A feature present in source is not proof that its database migration is applied or that the feature is enabled in a live environment.

## Start here

1. [`docs/PROJECT_TRUTH.md`](docs/PROJECT_TRUTH.md) — current source/build status and release authority.
2. [`docs/`](docs/) — architecture, domain hardening, operations, and historical audit notes.
3. [`docs/ops/TESTNET_EVIDENCE_OPERATOR_CHECKLIST.md`](docs/ops/TESTNET_EVIDENCE_OPERATOR_CHECKLIST.md) — operator evidence collection before release.
4. [`docs/MIGRATION_CHECKLIST.md`](docs/MIGRATION_CHECKLIST.md) — generated inventory of migration files, not remote application status.
5. [`docs/OPERATOR_ENV_AND_STATUS.md`](docs/OPERATOR_ENV_AND_STATUS.md) — operator-managed environment and feature status.
6. [`docs/OPERATOR_DEPLOYMENT_ENV_AND_MIGRATIONS_2026-10-21.md`](docs/OPERATOR_DEPLOYMENT_ENV_AND_MIGRATIONS_2026-10-21.md) — deployment and migration procedure.

## Local development

- Use the Node.js version specified by `.nvmrc` and `package.json`.
- Install reproducibly with `npm ci --legacy-peer-deps`.
- Copy `.env.example` to `.env.local` and fill it only with local test credentials. Never commit secrets.
- Run `npm run check:runtime`, `npm run typecheck`, `npm run lint`, and `npm run build`.
- Run the relevant source regression tests before submitting changes. See `package.json` for available scripts.

## Deployment status

The source is **not approved for production release** until the supported-runtime CI build, database reconciliation, and live Testnet verification gates pass. Historical Vercel logs are evidence about the source revision they built; do not assume an old reported TypeScript error still exists in this archive without rerunning the checks.

A successful static test or local source check does not establish that Supabase migrations, Pi payments, payout providers, media privacy, multi-user authorization, or production configuration have been verified. Keep Testnet and Mainnet credentials and data stores separate. Never bypass type checks, lint, migration review, or release gates to force a deployment.

## Safety boundaries

- GHC balances and financial settlement must remain server-authoritative.
- Pi and GHC are separate assets; do not imply automatic conversion.
- Social engagement must not mint GHC as a client-side side effect.
- Keep payout and other financially sensitive integrations disabled until their specific provider, database, reconciliation, and operator gates pass.
- Treat migration classifications as review metadata, not automatic authorization to apply migrations. Reconcile target migration history first.

## Project files

- `app/`, `components/`, `contexts/`, `features/`, `hooks/`, `lib/`: application source.
- `supabase/migrations/`: canonical migration files.
- `scripts/`: verification, regression, and operator scripts.
- `docs/`: current architecture, product-domain, security, and release documentation. Historical reports are segregated under `docs/archive/` and are not current status authority.

Private / proprietary unless otherwise stated by the repository owner.

