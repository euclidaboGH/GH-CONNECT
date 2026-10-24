# GreenHaven 0.74.0 — Marketplace + profile compact + media display

## Problems addressed (from live preview)

1. **Profile header** consumed too much vertical space (tall cover + large avatar).
2. **Marketplace listings** showed cube placeholders — card/detail media used raw `<img>` without signed-URL resolution for private-bucket facade URLs.
3. **Sell form** had no photo upload, no dual-rail listing fee CTA, no edit path, no owner delist/delete/share.
4. Listing fees were not shown on the submit button; edit fee policy (half create) was missing in UI.

## Changes

### Profile
- Cover height: `h-40/sm:h-52` → `h-28/sm:h-36`.
- Avatar overlap and size reduced for more content viewport.

### Media display (marketplace)
- `ListingCard`, listing detail hero, thumbnails, and related cards use `LazyImage` + `resolveDisplayMediaUrl` (same path as profile/feed).

### Marketplace sell / edit
- Photo picker (up to 6) via `uploadDurableMedia` → relative `/api/media/.../content` facades.
- Fee rail toggle **Pay with ₲ GHC | π Pi**.
- Submit CTA shows fee amount (`Publish · ₲ 1` / `Publish · pay 0.05 π`; edit half fee).
- Copy: listing fees **non-refundable**.
- **Edit** pre-fills form; `domain.updateListing` + half-fee messaging.
- Owner toolbar: Edit · Share · Delist (status `paused`) · Delete (status `removed`).

### Client fee helper
- `lib/marketplace/listing-fee-client.ts` — display quotes aligned with testnet defaults (1 GHC / 0.05 Pi create; half on edit). Optional `NEXT_PUBLIC_GHC_MARKETPLACE_LISTING_FEE_GHC` / `_PI`.

## Operator notes

- Server remains authoritative for fee settlement (`lib/server/marketplace/listing-fee.ts`).
- UI fee is honest display for testnet; wire payment intent on publish when operator enables fee collection APIs.
- Profile/cover still depend on successful durable upload + signed-url auth for own media.

## Version

`0.74.0`
