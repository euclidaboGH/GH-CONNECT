# Community section upgrade 0.77.0

## Gaps closed

| Gap | Fix |
|-----|-----|
| Cover was **data-URL / base64** only | Durable `uploadDurableMedia` + relative facade URL |
| Create fee hard-coded GHC in context | Dual-rail **GHC \| Pi** on create form; passed to API |
| Submit CTA had no fee amount | `Create · ₲ 5` / `Create · 0.1 π` |
| Hub cover used CSS `url()` (breaks private media) | `LazyImage` + `resolveDisplayUrl` |
| Hub cover too tall | Compacted to h-28 / sm:h-32 |
| socialCreate omitted cover/rules/welcome | Full payload to `POST /api/communities` |
| No server fee quote route | `GET /api/communities/create-fee` |

## Files touched

- `components/ghc/create-group-modal.tsx`
- `components/ghc/premium-community-hub.tsx`
- `contexts/ghc-context.tsx` (createGroup durable)
- `lib/social/client.ts` (`socialCreateCommunity`)
- `lib/community/create-fee-client.ts` (new)
- `app/api/communities/create-fee/route.ts` (new)

## Env (Vercel)

| Variable | Suggested | Privacy |
|----------|-----------|---------|
| `GHC_COMMUNITY_CREATE_FEE_GHC` | `5` | Private |
| `GHC_COMMUNITY_CREATE_FEE_PI` | `0.1` | Private |
| `NEXT_PUBLIC_GHC_COMMUNITY_CREATE_FEE_GHC` | `5` | Public (CTA) |
| `NEXT_PUBLIC_GHC_COMMUNITY_CREATE_FEE_PI` | `0.1` | Public (CTA) |
| `GHC_TESTNET_UNLOCK` | `1` | Private |

Existing community RPCs / migrations (`gh_communities_core`, platform v2) unchanged.

## Verify

1. Create community with cover photo → durable cover on Discover + hub header  
2. Fee rail GHC vs Pi → CTA label updates; create settles when rates approved  
3. Join public / request private; leave as non-owner  
4. Board / Chat tabs; share community  

Version **0.77.0**
