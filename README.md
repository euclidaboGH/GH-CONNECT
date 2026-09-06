# GreenHaven (GH Connect)

Human Connection OS — social connection, communities, messaging, discovery, and a separate GHC utility economy with optional Pi payments.

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

## Product pillars

| Area | Notes |
|------|--------|
| Feed / Home | Command centre, stories, create hub |
| Discover | Multi-intent discovery (not dating-only) |
| Messages | DMs separate from community boards |
| Communities | Belonging, board, events, governance |
| Wallet / GHC | Internal utility; not Pi |
| Pi payments | Separate rail; Testnet vs Mainnet by config |
| Marketplace | Listings; shareable to feed |

Architecture notes: `docs/SOCIAL_OS_ROADMAP.md`, `docs/HUMAN_CONNECTION_OS_COMMUNITY_ROADMAP.md`, `docs/HUMAN_CONNECTION_OS_AUDIT_60.md`

## Pi domain validation

Static file (required by Pi Developer Portal):

`public/validation-key.txt` → `https://<your-domain>/validation-key.txt`

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
