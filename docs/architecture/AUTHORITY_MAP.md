> **LEGACY VERIFICATION FIXTURE — NOT CURRENT PRODUCT AUTHORITY.**
> This document is retained only because an executable regression/operator check references it. For current implementation decisions, follow `docs/SOURCE_OF_TRUTH.md` and executable source. Do not resurrect historical behavior from this file.

# GreenHaven authority map

This document is a source-level orientation map, not evidence of a live deployment.

- **Identity:** Pi authentication is verified server-side. The server-owned session is the authority for authenticated requests; client-provided user IDs are not an authorization source.
- **Wallet and GHC:** server-side ledger/RPC operations are authoritative. Client state and optimistic UI are presentation only. A failed or unavailable durable operation must not be presented as a confirmed ledger mutation.
- **Pi payments:** payment intents and server callbacks/verification are authoritative. Never expose `PI_API_KEY` or wallet private seeds to client bundles.
- **Media:** durable media API results are authoritative. Data URLs, object URLs and local previews are not durable storage references.
- **Social reactions/curation:** votes and reactions are not direct GHC issuance. Any reward settlement must use its explicit server-side eligibility and ledger path.
- **Database:** migrations in `supabase/migrations/` describe source intent; their presence does not prove they are applied to Testnet or Mainnet.
- **Deployment:** Vercel, Supabase and Pi Developer Portal settings require operator-side verification. This map does not certify production readiness.
