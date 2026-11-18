# Operator Testnet release checklist — GreenHaven 0.312.0

**Use after Phases 1–5 source packages are reviewed.**  
Checkboxes are for humans; CI does not tick these.

## Before deploy

- [ ] Node engine **24.15.0** on CI and local verification  
- [ ] `package-lock.json` present; `npm ci --legacy-peer-deps`  
- [ ] `VERIFIED_MANIFEST.txt` `project_version=0.312.0` matches `package.json`  
- [ ] No secrets in tree (only `.env.example`)  
- [ ] Fail-closed flags remain `0` unless intentionally opened on Testnet  
- [ ] Pending migrations reviewed; notification `createdAt` fix applied if logs still show `42703`  

## After Preview deploy

- [ ] `/api/health/withdrawals` returns JSON without secrets  
- [ ] Login + Pi identity link  
- [ ] Wallet authorization consent path before withdraw  
- [ ] Own listing cannot checkout (`CANNOT_BUY_OWN` humanized)  
- [ ] Multi-item cart: GHC pays; multi-Pi residual in Orders  
- [ ] Communities **My** shows created/joined spaces  
- [ ] Discover follow updates CTA; failure rolls back  
- [ ] Messages show peer names when graph has data  
- [ ] Priority notifications filter works for unread high-signal types  

## Do not

- [ ] Enable Mainnet A2U on Preview  
- [ ] Claim production from source-only green builds  
- [ ] Bulk-credit users via ad-hoc SQL  

## Sign-off

| Role | Name | Date | Evidence link |
|------|------|------|----------------|
| Engineer | | | |
| Operator | | | |
