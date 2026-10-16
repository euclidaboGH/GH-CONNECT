# Two-account IDOR / isolation checklist

Use **Staging** and two Pi test accounts (A and B). Never disable RLS in Production.

## Setup

1. Sign in as **A**; complete onboarding; note GH user id from session/profile API.  
2. Sign in as **B** on another browser/profile; note GH user id.  
3. Capture session cookies or Bearer tokens for each (DevTools → Application / Network).

## Cases (expect 401/403, not other user’s data)

| # | Action as B | Target | Expected |
|---|-------------|--------|----------|
| 1 | `GET /api/profile/me` | — | Only B’s profile |
| 2 | `PATCH /api/profile/me` with body `{ "userId": "<A>" }` | A’s id in body | Ignored; updates B only or 400 |
| 3 | Wallet / economy summary with A’s id | A | 403 or B’s data only |
| 4 | `GET /api/messaging/conversations` | — | Only B’s memberships |
| 5 | `GET .../conversations/<A-private-id>/messages` | A’s conversation | 403 FORBIDDEN |
| 6 | `POST` message into A’s conversation | A | 403 |
| 7 | Notifications list | — | Only B’s notifications |
| 8 | Expired / revoked session | — | 401 |
| 9 | `Authorization: Bearer user:<A>` on Production | — | Rejected (dev token) |
| 10 | Missing cookie | — | 401 |

## Negative auth

- Cleared site data → must re-auth via Pi; must not invent identity.  
- Logout → previous cookie must not authorize API.  

## Record evidence

Save HTTP status codes and response `error` codes (no tokens in screenshots).

Automated helper (static / doc only):

```bash
npm run test:idor-checklist
```
