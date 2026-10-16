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
