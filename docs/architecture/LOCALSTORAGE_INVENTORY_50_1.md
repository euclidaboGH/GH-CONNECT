# localStorage inventory (seams in #50.1)

| Key / area | Class | Owner | Purpose | Prod allowed | Stale OK | Plan |
|------------|-------|-------|---------|--------------|----------|------|
| IdentityService memory | C/B | identity | session id | Yes | No for money | Server session later |
| Profile Pi SDK state keys | D | profile/ghc | offline profile blob | Cache only | Yes | Prefer server profile |
| posts storage key | D | feed | offline posts cache | Cache only | Yes | Server feed later |
| ghc.communities.* | D | communities | offline communities | Cache only | Yes | Supabase later |
| ghc_verification_v1 | D | verification | local verification UX | Read; no privileged write in prod | Yes | Server review |
| reputation storage | D | reputation | signals | Yes non-financial | Yes | Server signals |
| Theme / UI | D | UI | preferences | Yes | Yes | Keep |

**Forbidden as financial authority:** any localStorage key used as GHC balance or claim streak in production.
