# Deployment guide — 0.338.54 / Run #291

## Deployment sequence

1. Review the Run #291 source diff and confirm the payout-release migration remains `REVIEW_REQUIRED`.
2. Push the source to a non-production GitHub branch and wait for Vercel Preview + GitHub CI.
3. Confirm the postbuild footprint report identifies the largest workspace directories/files; do not suppress or hide npm deprecation warnings.
4. Run the complete Node 24.15.0 static, typecheck, lint and Next production build gates.
5. Reconcile the Testnet migration ledger against the canonical 221-file source inventory. Do not run bulk `db push`.
6. Only after source/DB review, apply the single reviewed Run #291 migration to Testnet, then verify the function definition, search_path, service_role-only ACL and no-row-mutation health probe.
7. Reconcile the three existing uncertain Pi earnings requests against Pi's authoritative provider state. Never retry or release solely because the local request has no provider payment ID.
8. Perform a small funded Testnet A2U acceptance with an approved test account and verify exact recipient UID/address, amount, network, provider payment ID, txid, verified receipt, developer completion, ledger settlement and idempotent retry behavior.
9. Complete browser, Android, Pi Browser, accessibility, responsive and two-account acceptance.
10. Keep Mainnet disabled until a separate signed release review approves credentials, wallet funding, provider/KYC requirements, migration history, monitoring and rollback.

## Rollback and safety

- Do not roll back financial ledger history or delete payout rows.
- Do not force-release `processing` or `uncertain` reservations.
- If a provider outcome is uncertain, stop retries and reconcile the original request/payment with Pi.
- Do not apply this Testnet migration to Mainnet without a separate review and explicit approval.
