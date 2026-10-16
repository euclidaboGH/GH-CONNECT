# Auth & Security Domain (GH-CONNECT)

This document freezes the intended architecture so implementation does **not** invent a second login system on top of Pi.

## Two layers (never collapse them)

| Layer | Question | Authority |
|-------|----------|-----------|
| **Server / Pi session** | Is this Pioneer authenticated? Is the token still valid? | Pi `/v2/me` + future GH session store |
| **Local app lock** | Is the person at this device still the owner of the open session? | Device PIN / future passkey; client state machine |

Primary identity remains **Pi Network** (`Pi.authenticate` → server verifies accessToken).

Local lock only mitigates **Threat A** (unlocked phone / idle device).

## Threat model

| Threat | Mitigation |
|--------|------------|
| A — Unlocked phone / idle app | App lock, lock-on-background, step-up for sensitive UI |
| B — Stolen browser session | Server session TTL, revocation, re-verify `/me` on money routes |
| C — Compromised OS | Cannot fully solve in web; Pi Wallet + server limits still apply |

## Client state machine

```
ACTIVE → IDLE → LOCKED → AUTHENTICATING → ACTIVE
              ↘ REAUTH_REQUIRED (failed PIN storm / expired Pi token)
              ↘ SESSION_EXPIRED
```

## Lock policies

- **high** — lock on background immediately; 1 min idle  
- **balanced** (default) — 30s background grace; 3 min idle  
- **convenience** — 2 min background grace; 5 min idle  

## Step-up (sensitive actions)

Even when the shell is unlocked, these require a **fresh unlock** (recent PIN) when a PIN is configured:

- GHC transfer / spend  
- Pi payment initiation (still followed by Pi Wallet)  
- Security settings / change PIN  

Server remains authoritative: balance, limits, approve/complete.

## What we deliberately do **not** do

- Treat `localStorage.isUnlocked = true` as authorization for money  
- Store plaintext PIN/password  
- Replace Pi Wallet authorization with app PIN  
- Put all security into the mega GHC context — lock lives in `session-lock-context` + `lib/session-security`  

## Roadmap (order)

1. ✅ Device PIN + idle + soft lock + failed-attempt escalation  
2. ✅ Lock policies + lock-on-background + step-up helpers  
3. ⬜ Server-issued GH session cookie/JWT with TTL + revoke  
4. ⬜ WebAuthn/passkey registration (server-stored public key) as unlock factor  
5. ⬜ Sign out other devices / active session list  
6. ⬜ Step-up enforced in economy API (header or recent-auth claim)  

## Code map

- `lib/session-security.ts` — policy, PIN hash, step-up, state helpers  
- `contexts/session-lock-context.tsx` — provider / idle / background  
- `components/ghc/session-lock-screen.tsx` — lock + setup UI  
- `app/api/auth/pi` — Pi identity bridge (server)  
- `lib/server/economy/auth.ts` — `/me` verification for APIs  
