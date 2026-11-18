# GreenHaven project source of truth

## Active authority
- The application source code in this repository is authoritative for implemented behavior.
- `supabase/migrations/` is the ordered, immutable database change history. Never delete or rewrite applied migrations.
- `.env.example` is the single canonical environment-variable name inventory. It contains safe defaults and blank placeholders, never credentials.
- Current deployment configuration is Vercel Preview scoped to Git branch `testnet`.
- Pi network selection is `PI_NETWORK=testnet`; Pi SDK Sandbox is `NEXT_PUBLIC_PI_SANDBOX=true`.
- `PI_ENV` selects the Pi Platform API mode and remains `production` where the app uses the production Platform API with Testnet network selection. Do not infer Mainnet from this variable alone.

## Historical records
Superseded RUN, PHASE, PASS, release and worklog documents are retained under
`docs/archive/historical-implementation-records/` for audit/history only.
They are not implementation instructions and must not override source code,
current migrations, or this document.

## Testnet safety
- Testnet-only constraints, identity validation, user consent, authorization,
  idempotency, balance checks, provider receipt verification, reconciliation,
  rate limits and audit logs remain mandatory.
- Never route Testnet transactions to Mainnet.
- Paystack/live bank transfers remain disabled in Testnet because they can move
  real fiat funds.
- Do not populate secrets in `.env.example` or commit local `.env` files.
