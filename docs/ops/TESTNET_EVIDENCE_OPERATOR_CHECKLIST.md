# GH-CONNECT v0.59.4 — Testnet Evidence Operator Checklist

**Phase:** Evidence collection only. No migrations. No code changes. No secrets in chat.

## 1. Run SQL pack

1. Open the Supabase project that backs **Testnet / Vercel Preview**.
2. SQL Editor → paste `TESTNET_EVIDENCE_COLLECTION_PACK.sql` → Run.
3. If Section B fails because `supabase_migrations.schema_migrations` is missing, note **HISTORY_UNKNOWN** and continue with C–J.
4. If Section H fails because a table is missing, note which statement failed; gap analysis in J still matters.
5. Export or copy **all result grids** (sections A–J + Z_SCRIPT_COMPLETE).

## 2. Environment attestation (TRUE/FALSE or short text — no secrets)

| Field | Your answer |
|-------|-------------|
| Preview / Testnet deployment URL | |
| Supabase project ref (dashboard) | |
| This Supabase project is the one Preview uses | TRUE / FALSE |
| `NEXT_PUBLIC_PI_SANDBOX` on Preview is `true` | TRUE / FALSE / UNKNOWN |
| Pi app network for this deployment is Testnet | TRUE / FALSE / UNKNOWN |
| Pi **server** credential on Preview is Testnet (not Mainnet) | TRUE / FALSE / UNKNOWN |
| Preview does **not** use Production Mainnet Pi credentials | TRUE / FALSE / UNKNOWN |
| Production Mainnet config remains a separate Vercel env | TRUE / FALSE / UNKNOWN |

**Do not paste:** `PI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, JWT secrets, passwords, cookies, access tokens.

## 3. Accounts

| Field | Answer |
|-------|--------|
| Two distinct Pi Testnet accounts available for the app | YES / NO |
| User A ready | YES / NO |
| User B ready | YES / NO |

## 4. Send back to engineering

- [ ] Full SQL output Sections **A–J** (and Z)
- [ ] Completed environment attestation table
- [ ] Testnet Preview URL
- [ ] Two-account confirmation
- [ ] Optional: note of any SQL statement that errored (relation missing is useful evidence)

## 5. Explicitly do not do yet

- Apply all 56 migrations blindly
- Apply all 31 staging migrations
- Mix 56 + 31
- Follow staging numeric order for claim migrations
- Change application code
- Change RLS to “make tests pass”
- Paste secrets into chat
- Declare Testnet payment reliability proven from one VIP success
