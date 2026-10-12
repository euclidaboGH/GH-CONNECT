# Rollback runbook

## Application

1. In Vercel / GitHub: redeploy the previous known-good commit.  
2. Do **not** delete Supabase tables to roll back app code.  

## Database

- New tables (`gh_user_profiles`, `gh_conversations`, `gh_messages`, …) can remain empty if APIs are reverted.  
- Keep `gh_pi_identities` and `gh_sessions` if users already signed in.  
- Economy ledger tables: **never** truncate to fix bugs.

## Feature flags

- Set `NEXT_PUBLIC_MESSAGING_DURABLE=0` (or unset) to disable durable chat client path.  
- Identity/session remain fail-closed in production without Supabase (503), which is intentional.

## Pi portal

Confirm the app URL still matches the deployment you rolled back to (Testnet vs Mainnet).

---

## Section A/B operator gates (2026-10-12)

1. Prefer Vercel instant rollback to last green Production deployment.  
2. Feature flags / env to disable first (no code deploy required when possible):
   - `NEXT_PUBLIC_MESSAGING_DURABLE=0`
   - ecosystem policy kill switches (rewards / ranking / marketplace) if configured
   - Pi sandbox mismatch: never point Production at Testnet keys  
3. Migrations: **do not** reverse-apply destructive SQL without a written plan; prefer forward-fix and disable traffic.  
4. Identity: if `IDENTITY_STORE_UNAVAILABLE`, fix Supabase credentials/migrations before re-enabling auth traffic.  
5. Verify after rollback: `GET /api/health/live`, `GET /api/health`, one Pi sign-in, one read-only wallet snapshot.

Checklist script: `npm run ops:ab-gates`
