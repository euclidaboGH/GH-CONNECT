# Upgrade worklog — GreenHaven 0.338.92

## Scope

This source increment corrects the fail-closed evidence scanner defaults in `20261117010001_gh_evidence_scoped_upload_chain_of_custody.sql`. Both research and field-report `scan_status` columns now default to `pending`, never `clean`. This ensures new and legacy evidence is not considered malware-scanned without a trusted scanner attestation.

## Testnet Vercel environment preparation

The existing Vercel project `gh-connect` has branch-scoped Preview variables for branch `testnet`: `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, and `GH_MEDIA_BUCKET=gh-media`. These point only to the Testnet Supabase project. Production variables were not changed, and no Production secrets were copied into Preview.

## Remaining operator prerequisites

- Add the Testnet `SUPABASE_SERVICE_ROLE_KEY` as a sensitive Preview variable scoped to branch `testnet`; it cannot be obtained through the available Supabase API-key connector and must never be copied from Production.
- Set `GHC_FIELD_ADMIN_USER_ID` to the intended central administrator's authenticated user ID.
- Configure `GHC_EVIDENCE_SCANNER_SECRET` only when a trusted malware-scanner worker is deployed and ready to sign callbacks.
- Apply the three migrations to Testnet in dependency order only after exact SQL payloads are reconciled against the live database.

## Database status

No migration was applied by this source increment. The connected GitHub `testnet` branch did not contain the three migration files, so its file API could not supply the exact SQL payloads to the Supabase migration runner. No database DDL was executed. Mainnet remains untouched.

## Deployment status

No GitHub commit, Vercel deployment, Mainnet change, or scanner activation was performed.
