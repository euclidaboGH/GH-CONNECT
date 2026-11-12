# GreenHaven Run #294 delivery

- Source: `GREENHAVEN-0.338.55-RUN293-WALLET-BUILD-FIX.zip` / user-provided `ghtytrr.zip`.
- Version remains `0.338.55`; this is an in-place maintenance correction, not a release-version bump.
- Fixed wallet reserved-funds explanatory copy so both the Priority 3 and Run #278 source-contract checks agree without weakening the never-started-only release boundary.
- Reviewed Run #251 and Run #252 source migrations and checked their live Testnet postflight state. The two operations exist in Testnet under generated versions `20261110092119` and `20261110092226`; exact historical SQL bodies were not available, so local candidate migrations remain `REVIEW_REQUIRED` and were not replayed or renamed.
- Current live Testnet catalog: 40 migration-history rows; 303 public SECURITY DEFINER functions; zero client-executable; 298 service-role-executable; five intentionally/legacy/internal non-service-role functions. Both Run #252 helper functions use `search_path=pg_catalog`.
- Existing source migration checks: 221/221 SQL lexical integrity; 221/221 source manifest; 221 unique 14-digit migration versions; Run #250–255 contracts passed.
- `npm run verify:static`: PASS (exit 0), including Priority 3, Run #278, Run #251, Run #252 and Run #291 contracts.
- Full Node 24.15.0 prebuild/typecheck/lint/Next.js build and disposable-PostgreSQL rehearsal remain unrun because the available local runtime is Node 22.16.0 and no local PostgreSQL/Docker runtime is installed.
- No database changes, migration history repair, payout/payment execution, GitHub push, or Vercel deployment performed.
- Release status remains NOT APPROVED.
