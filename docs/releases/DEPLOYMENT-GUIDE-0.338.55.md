# Deployment guide — 0.338.55 / Run #292

1. Import this source candidate to a dedicated non-production branch; do not overwrite the production branch.
2. Install with the repository's locked dependency command on Node 24.15.0.
3. Run `npm run verify:static`, `npm run typecheck`, `npm run lint` and `npm run build`.
4. Deploy only to Vercel Preview and inspect build/runtime logs.
5. Verify Marketplace, Communities, Discovery and Messages on narrow Android viewports and Pi Browser; verify keyboard, safe areas, scroll restoration and accessible focus.
6. Reconcile the complete migration sequence against Testnet before considering any SQL. Do not apply the wallet-address migration in isolation.
7. Resolve each uncertain Pi payout using authoritative provider evidence. Do not release or recreate any request based solely on a missing local provider ID or an empty incomplete-payment list.
8. Keep production and Mainnet disabled until all independent release gates pass and the operator explicitly approves release.
