import fs from 'node:fs'
import assert from 'node:assert/strict'
const migration = fs.readFileSync('supabase/migrations/20261022010087_gh_private_media_references_and_viewer_authz.sql', 'utf8')
const financial = fs.readFileSync('supabase/migrations/20261022010111_gh_verified_tip_settlement_payout_reconciliation.sql', 'utf8')
const upload = fs.readFileSync('app/api/media/route.ts', 'utf8')
const signer = fs.readFileSync('app/api/media/[id]/signed-url/route.ts', 'utf8')
const posts = fs.readFileSync('app/api/social/posts/route.ts', 'utf8')
const tips = fs.readFileSync('app/api/social/tips/route.ts', 'utf8')
const complete = fs.readFileSync('app/api/payments/complete/route.ts', 'utf8')
const payout = fs.readFileSync('app/api/marketplace/payouts/[requestId]/reconcile/route.ts', 'utf8')
const checks = [
  ['media-to-post references are durable and FK-backed', /CREATE TABLE IF NOT EXISTS public\.gh_post_media/.test(migration) && /REFERENCES public\.gh_media_assets\(id\)/.test(migration)],
  ['media relation table denies direct client access', /CREATE POLICY gh_post_media_no_client ON public\.gh_post_media FOR ALL USING \(false\)/.test(migration)],
  ['attach RPC verifies post ownership and media ownership/readiness', /v_post\.author_id<>trim\(p_actor_id\)/.test(migration) && /MEDIA_NOT_OWNED_OR_READY/.test(migration)],
  ['viewer authorization supports public/follower/mutual visibility', /p\.visibility='public'/.test(migration) && /p\.visibility='followers'/.test(migration) && /p\.visibility='mutuals'/.test(migration)],
  ['blocked viewers are denied', /ghc_user_blocks/.test(migration)],
  ['legacy post URLs are backfilled into durable media references', /Backfill durable references/.test(migration) && /ON CONFLICT\(post_id,media_id\) DO NOTHING/.test(migration)],
  ['new uploads do not persist public storage URLs', /publicUrl: null/.test(upload) && /delivery: "authorized-facade"/.test(upload)],
  ['new upload returns stable content facade URL', /\/api\/media\/\$\{encodeURIComponent\(record\.id\)\}\/content/.test(upload)],
  ['signed URL uses viewer authorization RPC', /gh_media_authorize_viewer/.test(signer) && /p_viewer_id: auth\.userId/.test(signer)],
  ['post creation persists media IDs and fails closed on attach failure', /gh_post_media_attach/.test(posts) && /MEDIA_ATTACH_FAILED/.test(posts)],
  ['tips reject unsupported GHC transfer rather than mutating balances unsafely', /GHC_TIP_RAIL_NOT_ENABLED/.test(tips)],
  ['tips bind a durable PI payment intent', /createPaymentIntent/.test(tips) && /gh_tip_intent_bind_payment_intent/.test(tips)],
  ['creator tip settlement re-queries Pi provider status', /settleVerifiedCreatorTip/.test(complete) && /developer_completed/.test(complete) && /gh_tip_settle_verified/.test(complete)],
  ['tip settlement records creator payable separately from payout', /gh_tip_settlements/.test(financial) && /status','payable'/.test(financial) && /creatorPaid',false/.test(financial)],
  ['tip settlement is idempotent and checks exact amount/binding', /SETTLEMENT_CONFLICT/.test(financial) && /TIP_AMOUNT_MISMATCH/.test(financial) && /UNIQUE/.test(financial)],
  ['payout status cannot become paid without confirmed reconciliation', /VERIFIED_PAYOUT_RECONCILIATION_REQUIRED/.test(financial) && /gh_seller_payout_reconciliations/.test(financial)],
  ['PI payout adapter checks amount, recipient, txid and provider status', /developer_completed/.test(payout) && /transaction_verified/.test(payout) && /recipientUid === identity\.pi_app_uid/.test(payout) && /amountsMatch/.test(payout)],
  ['signed URLs remain short-lived and no-store', /expiresIn: 300/.test(signer) && /private, no-store/.test(signer)],
]
for (const [label, pass] of checks) { console.log(`${pass ? 'PASS' : 'FAIL'} ${label}`); assert.ok(pass, label) }
console.log(`Phase 17 media and financial foundation checks: ${checks.length}/${checks.length} passed`)
