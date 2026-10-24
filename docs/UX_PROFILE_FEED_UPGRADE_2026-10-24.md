# UX Profile + Feed upgrade (0.73.0)

Grounded in live GreenHaven preview vs X/Facebook layout study.

## Implemented

### Profile (owner)
- Section tabs: **Posts · Media · Listings · Communities · About** (`ProfileSectionTabs`)
- Tab panels (no invented data):
  - Posts: moments + composer + owner timeline (existing)
  - Media: grid from post images/videos + moments + content library
  - Listings: CTA to Marketplace (seller listings surface)
  - Communities: `ProfileMyCommunities` (server membership only)
  - About: bio, location, education, profession
- Dashboard compact row kept below tabs (wallet/rewards tools)

### Profile (visitor)
- X-style dual primary CTAs: **Message | Follow** equal weight above detail sheet
- Existing circular match dock preserved (Pass / Follow / Like / Message)

### Feed
- Interstitials every 8 posts: People → Marketplace → Communities → Create cycle
- Fail-soft CTAs only; no fabricated users/listings (`feed-interstitial.tsx`)

### Unchanged (by design)
- Bottom nav 5 tabs
- Notification buckets
- Economy/ledger/auth/RLS
- Profile-more-nav grouping

## Files
- `components/ghc/profile-section-tabs.tsx` (new)
- `components/ghc/feed-interstitial.tsx` (new)
- `components/ghc/profile-screen.tsx`
- `components/ghc/profile-preview-page.tsx`
- `components/ghc/enhanced-feed-screen.tsx`
