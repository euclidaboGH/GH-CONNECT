# GREENHAVEN 0.338.30 — Run #269 system audit and Testnet ACL hardening

## Implemented

1. Corrected two stale prebuild UI regression contracts: the post-action toolbar now checks the current `gap-y-2` layout, the Comment accessible name with its dynamic count, and the native semantic `<article>` plus keyboard activation. No product UI behavior was weakened to satisfy a stale assertion.
2. Added the visual-cohesion and social-loop checks to `verify:static`, alongside their existing prebuild registration. The release-gate runner now checks this parity.
3. Replaced the Run #267 hard-coded package-version assertion with package/lockfile semantic-version synchronization.
4. Added a dedicated ACL regression gate for client table writes, sequence access, postgres default privileges, and the absence of browser-side Supabase clients/direct PostgREST access.
5. Applied Testnet migration `revoke_client_table_write_and_sequence_privileges` under generated history version `20261110174922`. It removes direct client mutation/DDL-adjacent privileges from existing public tables and sequences, and sets fail-closed defaults for future objects created by `postgres`. Existing SELECT grants, RLS policies, service-role privileges, and all business data were preserved.
6. Synchronized current release metadata, migration inventory and Testnet reconciliation notes with 0.338.30 and the 210-file source migration inventory.

## Live Testnet postflight

- 140/140 public tables retain RLS.
- 0 public tables grant `anon` or `authenticated` INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES or TRIGGER.
- 0/9 public sequences grant client-role USAGE, SELECT or UPDATE.
- `postgres` default ACLs for public tables and sequences now grant only to `postgres` and `service_role`; `service_role` retains SELECT on 121 public tables and 99 pre-existing anon SELECT grants remain RLS-governed; the separate `supabase_admin` default ACL remains platform-managed and unchanged because the migration role is not a member.
- Existing public SELECT remains available where already granted; the two unconditional public SELECT policies expose only public identity projection fields and economy-limit configuration.
- Security advisor retains only the 13 intentional RLS-enabled/no-policy INFO findings; performance advisor reports 111 unused-index candidates and no missing public FK indexes; health advisor reports no lints.
- The migration changed permissions only. It did not change balances, ledger entries, payout requests, payment intents, memberships, marketplace orders, or storage objects. Mainnet was not accessed or modified.

## Verification limits and remaining blockers

- `npm run verify:static` is rerun for this increment; source-only checks do not replace Node 24.15.0 dependency-backed typecheck, lint and production build.
- The prebuild diagnostic under available Node 22.16.0 skips the required Node runtime guard and the TypeScript-dependent JSX duplicate-props check because `node_modules` is absent. GitHub/Vercel Node 24 CI must provide final proof.
- The latest Testnet Vercel preview deployments failed at stale prebuild assertions; the two source assertions are corrected here. A successful new preview build is still required.
- Mainnet Supabase is inactive and the production Vercel project's Supabase URL maps to that inactive project. Do not unpause Mainnet or promote the Testnet branch as part of this increment.
- Three Pi earnings payout requests remain `uncertain`, with no provider payment ID, txid, receipt or provider verification and no active execution lease. Do not force-release, settle or retry them without authoritative Pi provider reconciliation.
- Two APPROVED membership intents remain without txid, completion timestamp or linked entitlement. Verify provider receipts before granting membership or cancelling anything.
- Testnet migration history has 13 generated records while the repository has 210 canonical migration files. Do not run `supabase db push`, migration repair or bulk replay until the full historical migration state is reconciled.
- Production remains NOT APPROVED.
