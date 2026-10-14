# GreenHaven (GH Connect)

## Implementation status

- Social, messaging, communities, wallet, Pi payments, and GHC ledger are implemented in source.
- GHPV (curation, active weights, settlement, calibration, soft-delete cleanup) is implemented in source. Migrations `20261013`–`20261020` are repository-only until Testnet.
- Settlement is system-only (`GH_SETTLEMENT_INTERNAL_KEY`). Votes do not mint GHC.
- Post restoration after soft-delete is not implemented.
- CQI feed ranking, vote-to-GHC, and creator quality payouts are deferred.
- Typecheck, lint, and production build were blocked in the last packaging environment because `node_modules` was incomplete. Do not treat static tests as a production claim.


Human Connection OS — social connection, communities, messaging, discovery, and a separate GHC utility economy with optional Pi payments.


## Maintenance / Phase 14 (as of 2026-10-10)

| Item | Status |
|------|--------|
| Migration inventory | **70** files — `docs/MIGRATION_CHECKLIST.md` |
| Static security suites | `npm run verify:static` |
| Design tokens runtime | **`app/globals.css`** (only stylesheet; the unused `styles/globals.css` copy was removed) |
| Typecheck / production build | Operator machine — sandbox may OOM on `npm ci` |

```bash
npm ci --legacy-peer-deps
npm run verify:static
npm run audit:profile
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


## Profile content library

The profile and peer-profile surfaces now include a searchable content library for posts, photos, videos, PDF attachments and profile-photo history. Its server-authorized query API requires the additive `20261023_gh_profile_content_library.sql` migration; apply it on Testnet and verify relationship/privacy behavior before release. See `docs/GH_MEDIA.md` for the media-storage privacy caveat and rollout steps.

See `docs/GH_PROFILE_CONTENT_LIBRARY.md` for the feature specification, authorization model, migration rollout, verification and media-storage release gate.

## Profile-connected hardening pass B (2026-10-14)

- Peer-profile preview is now mounted by the app shell and handles the shared `ghc:open-profile` event used by multiple surfaces.
- Story and media APIs have additional request bounds, URL/identifier validation, per-user rate limits, no-store responses and safer error payloads.
- Message read/edit/delete and conversation creation paths have additional rate and input bounds.
- Run `npm run audit:profile-connected-v2` as an additional static gate. This complements, but does not replace, full typecheck/lint/build and Testnet verification.
