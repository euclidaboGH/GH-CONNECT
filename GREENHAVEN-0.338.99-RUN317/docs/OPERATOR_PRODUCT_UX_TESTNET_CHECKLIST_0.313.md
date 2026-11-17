# Operator Testnet checklist — 0.313.0 product UX track

Do **not** treat SOURCE VERIFIED as live proof.

## 1. Source

- [ ] Unzip release package; confirm `package.json` version `0.313.0`
- [ ] `node scripts/check-phase5-product-ux-release-gate-2026-11-04.mjs` → all PASS

## 2. Database (Testnet only)

- [ ] Review `supabase/migrations/20261104180001_gh_community_list_memberships_viewer.sql`
- [ ] Apply on disposable Postgres first (empty + sample memberships)
- [ ] Apply on Testnet
- [ ] Confirm privileges: `gh_community_list_memberships` → service_role only

## 3. Deploy Preview

- [ ] Commit/push reviewed tree to GitHub
- [ ] Vercel Preview build green (`npm ci` + `npm run build`)
- [ ] Open Preview URL (not Mainnet)

## 4. Smoke (Pi Browser / mobile web)

- [ ] **Stories:** upload photo → Share succeeds (no `INVALID_MEDIA_URL`)
- [ ] **Discover:** Follow updates; no invented “Last seen Xh”; 1 person grammar
- [ ] **Communities:** My tab lists memberships after migration; “1 member” grammar
- [ ] **Feed:** leave tab and return → soft refresh without full-page hang
- [ ] **Composer:** Photo / Video / Story quick actions open correct flows
- [ ] **Notifications:** opens on Priority (or last saved focus)

## 5. Wallet / A2U (still separate)

- [ ] Withdraw path: Authorize → quote → request only when flags + funding ready
- [ ] Do not enable Mainnet A2U from this checklist

## Decision

- **GO (Preview Testnet UX)** only if sections 1–4 pass  
- **CONDITIONAL GO** if migration pending but media/feed/discover smoke pass  
- **NO-GO** if build fails or raw error codes return on story publish  
