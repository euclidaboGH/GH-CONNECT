# Phase 1–14 completion matrix (source)

**Scope:** Existing architecture only. Phase 15 frozen.  
**Inventory:** ~808 source-ish · 427 `.ts` · 150 `.tsx` · 105 API routes · 123 components · 300 lib · 54 migrations.

| System | UI | API | Server | DB/RPC | Wired | Persist (intent) | Secured (source) | Status |
|--------|----|-----|--------|--------|-------|------------------|------------------|--------|
| Auth / session | Y | Y | Y | Y | Y | session+DB | session actor | COMPLETE (source) |
| Profile | Y | Y | Y | Y | Y | durable profiles | owner | COMPLETE (source) |
| GHC ledger | Y | Y | Y | Y | Y | ledger | server | COMPLETE (source) |
| Daily claim | Y | Y | Y | Y | Y | atomic claim | session | COMPLETE (source) |
| Pi payments | Y | Y | Y | Y | Y | intents | ownership | COMPLETE (source) |
| Membership | Y | Y | Y | Y | Y | entitlements | after payment | COMPLETE (source) |
| Feed/posts | Y | Y | Y | Y | Y | gh_posts | actor | COMPLETE (source) |
| Reactions/share | Y | Y | Y | Y | Y | durable | actor | COMPLETE (source) |
| Notifications | Y | Y | Y | Y | Y | durable | recipient | COMPLETE (source) |
| Messaging | Y | Y | Y | Y | Flag | durable SQL | membership | PARTIAL — flag `NEXT_PUBLIC_MESSAGING_DURABLE` |
| Communities | Y | Y | Y | Y | Y | core | join-decide | COMPLETE (source) |
| Marketplace | Y | Y | Y | Y | Y | listings/orders | seller/buyer | COMPLETE (source) |
| Creator | Y | Y | Y | Y | Y | profiles | owner | COMPLETE (source) |
| Tips | Y | Y | Y | intent | Y | intents | deferred settle | INTENTIONALLY DISABLED settle |
| Reputation | Y | Y | Y | Y | Y | events/state | server proof | COMPLETE (source) |
| Media/upload | Y | Y | Y | assets | **Fixed** | storage+DB | session owner | COMPLETE (source) — path `/api/media` |
| Withdrawal | Y | Y | Y | Y | Y | requests | operator | COMPLETE (source) |
| A2U / staking | — | Y | gated | — | gated | — | admin | INTENTIONALLY DISABLED |
| Ecosystem COMING_SOON | landing | — | — | — | — | — | — | INTENTIONAL product gate |
| App lock / WebAuthn | Y | Y | Y | Y | Y | local PIN / server step-up | as designed | COMPLETE (source) |
| Admin credit / verification | — | Y | Y | — | key | — | privileged | COMPLETE (source) |

## Fix this pass

- `lib/media-pipeline.ts`: default upload path `/api/media`, `credentials: "include"`, allow same-origin without `NEXT_PUBLIC_API_URL`.

## Not done (operator / live)

Windows typecheck/build · Testnet migration list · schema · IDOR · Pi E2E · Mainnet.

## Phase 15

**NOT STARTED — FROZEN**
