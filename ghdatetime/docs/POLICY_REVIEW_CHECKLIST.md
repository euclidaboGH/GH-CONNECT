# Policy review checklist

Run this checklist before publishing material product changes that affect data or money.

## Triggers (`lib/legal/policy-meta.ts` → `POLICY_REVIEW_TRIGGERS`)

- [ ] New or expanded data collection or identity fields
- [ ] Pi SDK scope, authentication, payment, or profile access changes
- [ ] Wallet, GHC ledger, rewards, curation, or monetization behaviour changes
- [ ] New messaging, social, marketplace, creator, education, transport, or donation features
- [ ] Media storage provider, region, retention, or access-control changes
- [ ] Analytics, cookies, advertising, or third-party SDK additions
- [ ] Account deletion, retention, or privacy-rights procedure changes

## Update steps

1. Edit structured content in `lib/legal/privacy-policy.ts` and/or `lib/legal/terms-of-service.ts` and `lib/legal/support-content.ts`.
2. Update dates in `lib/legal/policy-meta.ts`.
3. Confirm public routes remain unauthenticated: `/privacy`, `/terms`, `/support` (`components/app-wrapper.tsx`).
4. Operator + qualified counsel review for material legal changes.
5. Deploy; verify pages in an Incognito window without Pi sign-in.
6. Update Pi Developer Portal Privacy Policy URL if the production origin changed.

## Do not

- Auto-publish unreviewed legal text because code shipped.
- Claim Pi Network endorsement or certification.
- Promise withdrawal, anonymity, or absolute security without product evidence.
