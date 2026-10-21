# GH-CONNECT Repository Map

This guide is the stable entry point for engineers. Existing paths are intentionally preserved because scripts, CI, imports and historical reports may reference them.

## Runtime and product code

| Path | Responsibility | Audit guidance |
|---|---|---|
| `app/` | Next.js routes, pages, API endpoints and route handlers | Treat every API route as a security boundary; test auth, ownership and validation. |
| `components/` | Shared UI components and shell-level components | Keep rendering/presentation separate from privileged business operations. |
| `features/` | Feature-domain entry points and modules | Prefer domain ownership; avoid parallel implementations of the same capability. |
| `contexts/`, `hooks/` | Shared client state and reusable hooks | Do not treat client state as authoritative for permissions, balances or payment completion. |
| `lib/` | Shared domain logic, clients, server helpers, configuration and integrations | Keep server-only secrets and privileged clients out of client-importable modules. |
| `types/` | Shared TypeScript contracts | Validate untrusted runtime data at boundaries; types alone do not validate input. |
| `public/` | Public static assets | Never place secrets or private user content here. |

## Data and deployment

| Path | Responsibility | Audit guidance |
|---|---|---|
| `supabase/migrations/` | Canonical SQL migration sequence | Never bulk-apply; follow `docs/MIGRATION_CHECKLIST.md` and the approval classification. |
| `supabase/` outside migrations | Supabase configuration and supporting assets | Verify environment/network targeting before operator use. |
| `scripts/` | Static regression checks, audit tools and operator commands | Confirm a script's target environment and side effects before running it. |
| `e2e/` | Browser end-to-end scenarios | Run against an explicitly configured safe base URL; production E2E requires the documented opt-in. |
| `.github/workflows/` | CI and release automation | CI green is necessary but not sufficient for Testnet or Mainnet approval. |
| `next.config.mjs`, `middleware.ts`, `vercel.json` | Framework, request and deployment policy | Review security headers and route behavior as one combined policy. |
| `.env.example` | Environment variable template | Names only; never copy real secrets into the repository. |

## Canonical engineering documents

- `README.md` — product/repository overview and developer entry point.
- `docs/README.md` — topic-based documentation index.
- `docs/PHASE_IMPLEMENTATION_STATUS.md` — implementation/verification status vocabulary and phase summary.
- `docs/MIGRATION_CHECKLIST.md` and `VERIFIED_MANIFEST.txt` — generated migration inventory and operator review.
- `docs/DEFERRED_AND_GATED.md` — deliberately disabled, incomplete or approval-gated functionality.
- `docs/TESTNET_VERIFICATION_GATE.md` — operator evidence required before launch.
- `docs/PRODUCTION_OPS.md` and `docs/ROLLBACK_RUNBOOK.md` — operational readiness and rollback.
- `docs/engineering/10_PHASE_GLOBAL_LAUNCH_REMEDIATION_PLAN.md` — ten-phase remediation programme and current source-only evidence.

## Safe file organization policy

Do not move application source, migrations, scripts, environment templates or workflows as a cosmetic cleanup. Their paths may be part of runtime imports, CI contracts, deployment configuration, migration history, or operator runbooks. Start by indexing and assigning ownership. A later move requires a reference search, import/script/link update, test run and explicit review.
