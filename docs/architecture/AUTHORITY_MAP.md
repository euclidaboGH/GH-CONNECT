# GreenHaven Authority Map (PROMPT #50)

**Classification scheme**

| Class | Meaning | Examples |
|-------|---------|----------|
| **A** | Production DB authority (Supabase / ledger) | GHC balances, claim streak, Pi payment intents, membership entitlements when migrated |
| **B** | Server durable API authority | Economy API routes, payment approve/complete, connection request RPCs |
| **C** | Temporary session authority (process memory / request scope) | In-flight UI wizards, non-financial telemetry buffers |
| **D** | Local UI preference / cache only (localStorage allowed) | Theme, joined-ids *cache*, draft compose text, board post *offline cache* |
| **E** | Legacy / duplicate authority scheduled for removal | Parallel stores that compete with A/B |

**Rules**

1. Never promote D/C data to financial truth.
2. Production must **fail closed** when A/B is required and unavailable — not fall back to demo seed.
3. Client mutations that change trust/verification/reputation must not be authoritative in production without a server boundary.
4. localStorage is never Class A.

---

## Domain authority matrix

| Domain | Current primary | Target primary | Class today | Class target | Notes |
|--------|-----------------|----------------|-------------|--------------|-------|
| **Identity / Pi auth** | Pi SDK + IdentityService | Same + server-verified token | B/D hybrid | B | Pi UID → GH user; no hardcoded `"current-user"` in production paths |
| **Profile** | GHCContext + profile store | Profile domain + server | D/B | A/B | Public profile must not expose GHC balance |
| **Social graph / Connections** | Unified connection adapter + optional RPC | Server-backed requests | B/D | A/B | Migration `20260905_connection_request_intents.sql` NOT auto-applied |
| **Discovery** | Adapters + empty production lists | Server ranking later | D/B | B | No seed in production (`isDemoDataAllowed`) |
| **Feed / Posts** | GHCContext feed | Feed domain + server | D | A/B | Create hub is UI only |
| **Messaging** | Conversations in context | Messaging domain | D | A/B | DMs ≠ community board |
| **Communities** | Domain + **localStorage persistence** | Supabase community tables | **D** (declared) | **A** | `community-persistence.ts` is explicit interim cache |
| **Community membership** | Membership adapter + localJoined cache | DB membership | D/B | A | UI may cache; join must call adapter |
| **Community board** | localBoard + domain board | Server posts | D | A | Cap message persistence |
| **Community governance log** | Process-memory / session | Append-only DB log | **C** | A | Not financial |
| **Events / Activities** | Domain loaders | Server | D/B | A/B | Non-financial participation |
| **Reputation** | localStorage domain | Server signals | **D** | A | Must never be purchasable with GHC |
| **Verification** | localStorage; client approve/reject | Server review workflow | **D + risk** | **B** | Client approve/reject **blocked in production** (see guard) |
| **Search** | Universal search adapters | Same + index later | D/B | B | Privacy filter required |
| **Notifications** | notificationSystem + deep links | Server fan-out later | C/D | B | Deep links must not open Settings by default |
| **GHC ledger** | Supabase ledger + RPCs | Same | **A** | **A** | Do not weaken |
| **Rewards / claims** | Server claim engine | Same | **A/B** | **A/B** | ECONOMY_VERSION 1.2 |
| **Membership VIP/VVIP** | Entitlement store + DB path | DB authoritative | A/B | A | 150 / 300 GHC locked |
| **Pi payments** | Durable intents + approve/complete | Same | **A/B** | **A/B** | PI_API_KEY server-only |
| **Marketplace** | Listings domain | Server orders | D/B | A/B | Share → feed uses listingId |

---

## localStorage inventory (classified)

| Key / area | Class | Allowed in production? |
|------------|-------|------------------------|
| `ghc.communities.conversations.v2` | D cache | Yes as offline cache only; not sole membership truth |
| `ghc.community.joinedIds` | D cache | Yes as cache; reconcile with membership adapter |
| `ghc.community.boardPosts` | D cache | Yes offline drafts/cache |
| `ghc_verification_v1` | D | Read OK; **mutating approve/reject/revoke production-blocked** |
| Reputation storage key | D | Signals only; no financial side effects |
| Theme / UI prefs | D | Yes |

---

## Community lifecycle

| State | Transitions out |
|-------|-----------------|
| draft | discoverable, archived |
| discoverable | active, quiet, archived |
| active | quiet, archived |
| quiet | active, archived |
| archived | **active** (restore — owner/admin only, product path) |

Restore is an explicit transition: `archived → active` (or `discoverable` when not yet launched).

---

## Nigeria-first / low-bandwidth notes

- Prefer progressive images, lazy tabs, skeleton UI over blank screens.
- Cache Class D community lists for offline read; never invent balances offline.
- Minimize JS on first Home paint; code-split wallet/marketplace/create.
- Respect intermittent connectivity: queue non-financial drafts; financial ops require online server ack.

## Privacy (NDPR-aligned principles)

- Minimize personal data collection.
- Purpose limitation for location/LGA data (profile + discovery only).
- No public GHC balances.
- Verification evidence is not client-authoritative.

## Security posture

- OWASP ASVS-minded: server authZ on money and verification decisions.
- Supabase: no client write policies on ledger tables; SECURITY DEFINER RPCs with tight grants.
- Next.js: no `ignoreBuildErrors` / `ignoreDuringBuilds`.

---

## Strangler-fig order (remaining)

1. Label + guard verification mutations (this prompt)
2. Lifecycle restore path
3. Communities UI: membership adapter primary, localJoined as cache
4. Extract slices from ghc-context (Identity / Feed / Wallet providers) — incremental
5. Durable community tables (migration proposal only until operator applies)
6. Reputation server signals

**Financial Class A systems are frozen against weakening.**
