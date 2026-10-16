# Pi Identity Bridge — GreenHaven (GH-CONNECT)

Strict compliance with Pi Network Platform documentation (SDK + Platform API).

## Official rules we follow

1. **Client data is untrusted**  
   `Pi.authenticate()` returns `user.uid` and `accessToken`. Only the `accessToken` is sent to our backend. Client `uid` is never used as proof of identity.

2. **Server verification**  
   Backend calls `GET https://api.minepi.com/v2/me` with  
   `Authorization: Bearer <accessToken>`.  
   Only the `uid` / `username` from that response are trusted.

3. **App-specific uid**  
   Pi `uid` is specific to this app. It can change if the user revokes permissions. We store it as `pi_app_uid` and use it as the join key for *this* application only. We do not assume a universal cross-app identity.

4. **No Fireside / Profiles API scraping**  
   There is no public Platform API for full Fireside profiles. We display verified username and may deep-link later; we do not scrape internal Pi social APIs.

5. **Authentication ≠ Onboarding**  
   - Authentication: “Who is this Pioneer?” (Pi + `/me`)  
   - Onboarding: “How does this person want to participate in GreenHaven?” (interests, intent, etc.)  
   Returning users who already completed GH onboarding skip the full onboarding flow.

6. **Payments unchanged**  
   U2A still requires Server API Key approve + complete. Identity bridge does not alter payment security or GHC economics.

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/auth/pi` | Body: `{ accessToken }`. Verify `/me`, find-or-create mapping, return `needsOnboarding` / `isReturning`. |
| POST | `/api/auth/onboarding-complete` | Marks GH onboarding finished (Bearer Pi token required). |

## Client flow

```
Pi.init → Pi.authenticate(['username','payments'], onIncompletePaymentFound)
    → POST /api/auth/pi { accessToken }
    → IdentityService.setFromPi({ ..., verifiedByServer, needsOnboarding })
    → if needsOnboarding → GreenHaven onboarding UI
    → else → Home / Command Centre
```

## Storage

In-memory map (`lib/server/identity/pi-identity-store.ts`) suitable for single-instance / Preview. For multi-instance production, back with durable store (e.g. Supabase) using the same record shape:

- `ghUserId`
- `piAppUid` (unique)
- `piUsername`
- `onboardingCompleted`
- timestamps

## PiNet / guest

Public content may remain browsable without forcing auth (PiNet guidance). Force Pi authentication only when identity or payments are required.
