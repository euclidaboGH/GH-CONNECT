# Eight-step production hardening

Implemented as a single controlled pass after the production-readiness audit.

## Steps completed (code)

| Step | Focus | Outcome |
|------|--------|---------|
| 1 | Community authority | `isJoined` → domain-first helper; localJoined/localBoard load/persist **Studio-only** |
| 2 | Global layout shell | `--gh-nav-height` + full bottom inset; `.gh-scroll-root` / content column |
| 3 | Messaging performance | Smaller message window (40) / step (30) for lower memory on Pi Browser |
| 4 | Context seams | `MessagingProvider` + `NotificationsProvider` under GHC facade |
| 5 | Profile / Discover layout | Profile shell class; slim header tokens; Discover scroll root |
| 6 | Persistence isolation | `community-persistence` refuses localStorage **writes** when demo disallowed |
| 7 | Config posture | Node 24.x, safety scan, vercel CSP retained |
| 8 | Verification | Automated suites + explicit **operator** gates |

## Still required for true production

These cannot be closed inside the sandbox alone:

1. `npm install --legacy-peer-deps && npm run typecheck && npm run lint && npm run build`
2. Green Vercel deploy of the same commit
3. Supabase migration reconcile (apply only missing **additive** migrations)
4. Live **Test-Pi** diagnostic in Pi Browser
5. Multi-instance claim/spend smoke (recommended)

## Financial isolation

No changes to ECONOMY_VERSION 1.2 constants, Pi rails, or ledger authority in this pass.
