# GreenHaven (GH Connect)

## Implementation status

- Social, messaging, communities, wallet, Pi payments, and the GHC ledger are implemented in source.
- GHPV (curation, active weights, settlement, calibration, soft-delete cleanup) is implemented in source. The migration history remains repository-only until each environment is reconciled and tested.
- The 2026-10-11 global ecosystem pass adds durable feed preferences, diversity reranking and impression telemetry; server-authoritative XP levels; consent-based referral codes and verified qualification; contextual trust dimensions and appeals; reward holds/appeals and wallet export; marketplace stock reservations, idempotent checkout, atomic GHC/Pi finalization, GHC ledger-linked refunds for disputed orders, delayed reviews, listing reports/moderation and seller analytics.
- `docs/product/GLOBAL_ECOSYSTEM_IMPLEMENTATION_STATUS.md` lists exact implemented scope and remaining limitations; `docs/operations/GLOBAL_ECOSYSTEM_ROLLOUT.md` contains the rollout/recovery runbook.
- Static gates pass, but full typecheck, lint, build, Testnet migration apply, Pi Browser E2E and multi-instance concurrency are not certified here. Do not treat static tests as a production claim; Pi refunds and referral payouts remain disabled.


Human Connection OS — social connection, communities, messaging, discovery, and a separate GHC utility economy with optional Pi payments.


## Maintenance / Phase 14 (as of 2026-10-10)

| Item | Status |
|------|--------|
| Migration inventory | **70** files — `docs/MIGRATION_CHECKLIST.md` |
| Static security suites | `npm run verify:static` |
| Design tokens runtime | **`app/globals.css`** (canonical). `styles/globals.css` is non-canonical |
| Typecheck / production build | Operator machine — sandbox may OOM on `npm ci` |

```bash
npm ci --legacy-peer-deps
npm run verify:static
npm run typecheck
npm run lint
NODE_OPTIONS="--max-old-space-size=6144" npm run build
```

Do **not** apply all migrations blindly. Do **not** enable durable messaging until IDOR gates pass.

## Stack

- Next.js 15 (App Router)
- TypeScript / React
- Tailwind CSS
- Supabase (ledger / economy when configured)
- Pi Network SDK (server-side approval/completion)

## Quick start

```bash
npm install --legacy-peer-deps
cp .env.example .env.local
# Fill server-only secrets in .env.local — never commit them
npm run dev
```

Production-style checks:

```bash
npm run typecheck
npm run lint
npm run build
npm run test:economy
node scripts/test-pi-payment-durable.mjs
```

## Environment

Copy `.env.example` → `.env.local`.

- **Never** commit `.env` or `.env.local`
- `PI_API_KEY` and Supabase **service role** keys are **server-only**
- Use `NEXT_PUBLIC_*` only for non-secret client config

See `.env.example` for variable names.

## Foundation readiness (release gate)

Stabilize config **before** shipping more product features.

| Endpoint | Role |
|----------|------|
| `GET /api/health/live` | Process liveness only |
| `GET /api/health` | Full readiness (Client ID, API key, Supabase durability, network mode) |
| `GET /api/payments/health` | Pi payment rail readiness |

On **Production**, `/api/health` returns **HTTP 503** when critical blockers exist (`status: "not_ready"`).

**Ship only when** Production shows `"status": "ready"` and payments health `ready: true`.

Full sandbox vs mainnet matrix and checklist: [`docs/FOUNDATION_READINESS.md`](docs/FOUNDATION_READINESS.md).

In the app: **Settings → About** shows a non-secret foundation status card.

## Product pillars

| Layer | Surfaces |
|-------|----------|
| Identity | Pi sign-in, profile, GH ID |
| Social | Feed, Discover, Messages, Matches |
| Belonging | Communities (board + member chat) |
| Value | Wallet, Rewards, Membership (GHC — not π) |

Home prioritizes one **next action**; Profile groups **Social · Value · Tools**.  
See [`docs/PRODUCT_CLARITY.md`](docs/PRODUCT_CLARITY.md).
| Marketplace | Listings; shareable to feed |

Architecture notes: `docs/SOCIAL_OS_ROADMAP.md`, `docs/HUMAN_CONNECTION_OS_COMMUNITY_ROADMAP.md`, `docs/HUMAN_CONNECTION_OS_AUDIT_60.md`

## Pi domain validation

Set `DOMAIN_VALIDATION_KEY` in Vercel (per environment). The app serves it at:

`https://<your-domain>/validation-key.txt` → rewrite → `/api/validation-key`

Do not commit the key. Missing env returns 503 (fail-closed).

## Deploy (Vercel)

- Root directory = folder containing `package.json`
- Install: `npm install --legacy-peer-deps` (or `npm ci` when lockfile is in sync)
- Build: `next build`
- Node: `24.x` (see `package.json` engines)
- Set env vars in the Vercel project — do not upload `.env` files

## Safety

- GHC ledger operations are server-authoritative
- No automatic GHC ↔ Pi conversion
- Community/social actions do not mint GHC on the client
- Demo/seed data must not appear in production paths

## License

Private / proprietary unless otherwise stated by the repository owner.
