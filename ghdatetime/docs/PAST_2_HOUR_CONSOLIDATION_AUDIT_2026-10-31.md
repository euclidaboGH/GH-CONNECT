# GreenHaven — Consolidation Audit — 2026-10-31

Scope: wallet/claim notifications, notification center, refresh coordination, community/chat governance, app shell/realtime/scroll, posts/curation/comments.

## Confirmed
- Wallet/claim UX regression contract: 8/8.
- Notification center contract: 10/10.
- Shared section refresh contract: 12/12.
- Community/chat governance contract: 11/11 after consolidation fixes.
- Shell/realtime/scroll contract: 8/8.
- Post/curation production contract: 12/12.
- Full network/DB-independent static verification: 57/57.

## Consolidation fixes
1. Removed an overlooked implicit community-chat enrollment from the community join-request approval path. Community membership approval no longer inserts the member into messaging. Chat remains owner-created and explicit opt-in/approval according to chat privacy.
2. Hardened community role and membership-decision mutation bodies with the shared bounded streaming JSON parser.
3. Hardened story reaction mutation bodies with the shared bounded streaming JSON parser.
4. Expanded the community regression contract so both direct join and moderated approval paths are checked against silent chat enrollment, and governance/story mutation body bounds are protected.

## Boundary
Static/source verification is not a substitute for applying reviewed migrations, funded Pi Testnet evidence, configured realtime infrastructure, or the Node 24 Vercel production build. Existing legacy request.json(), browser confirm/prompt, and polling occurrences outside this consolidation scope remain technical-debt candidates for dedicated hardening rather than unsafe bulk replacement.
