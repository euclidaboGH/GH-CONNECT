import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd();
const dir = path.join(root, 'supabase/migrations');
const files = {
  membership: '20261107160001_membership_active_tier_downgrade_guard.sql',
  variants: '20261107180001_marketplace_sku_variants_atomic_inventory.sql',
  fulfilment: '20261107190001_marketplace_fulfilment_tracking_timeline.sql',
  wallet: '20261108110001_phase3_wallet_rewards_membership_concurrency_recovery.sql',
  messaging: '20261109100001_gh_messaging_phase1_controls_search.sql',
  a2u: '20261110210001_pi_a2u_ecosystem_qualification.sql',
};
const sql = Object.fromEntries(Object.entries(files).map(([k, f]) => [k, fs.readFileSync(path.join(dir, f), 'utf8')]));
const phase4 = fs.readFileSync(path.join(root, 'supabase/proposals/20261118_phase4_identity_group_contact.sql'), 'utf8');
const definer = (s) => [...s.matchAll(/SECURITY\s+DEFINER[\s\S]{0,100}?SET\s+search_path\s*=\s*([^\n$]+)/gi)].map(m => m[1].trim());

assert.match(sql.membership, /BEFORE UPDATE OF tier, active, expires_at/);
assert.match(sql.membership, /MEMBERSHIP_DOWNGRADE_NOT_ALLOWED/);
assert.match(sql.membership, /SET search_path = pg_catalog, public, pg_temp/);

assert.match(sql.variants, /stock_reserved>=OLD\.stock_reserved/);
assert.match(sql.variants, /stock_on_hand>=OLD\.stock_reserved/);
assert.match(sql.variants, /VARIANT_RESERVATION_INVARIANT_VIOLATION/);
assert.match(sql.variants, /VARIANT_STOCK_COMMIT_INVARIANT_VIOLATION/);
assert.doesNotMatch(sql.variants, /stock_reserved=greatest\(0,stock_reserved-OLD\.stock_reserved\)/);
assert.match(sql.variants, /VARIANT_SELECTION_REQUIRED/);
assert.match(sql.variants, /REVOKE ALL ON FUNCTION public\.gh_marketplace_order_create_reserved_pre_variant/);

assert.match(sql.fulfilment, /gh_marketplace_order_events/);
assert.match(sql.fulfilment, /DELIVERY_STATE_CHANGED/);
assert.match(sql.fulfilment, /DISPATCH_REQUIRED/);
assert.match(sql.fulfilment, /buyer_confirm/);
assert.match(sql.fulfilment, /SET search_path\s*=\s*pg_catalog, public, pg_temp/);
assert.doesNotMatch(sql.fulfilment, /CREATE TABLE\s+public\.gh_marketplace_order_events/i);

assert.match(sql.wallet, /provider_receipt IS NULL/);
assert.match(sql.wallet, /provider_verified_at IS NULL/);
assert.match(sql.wallet, /PROVIDER_OUTCOME_UNKNOWN/);
assert.match(sql.wallet, /pg_catalog\.pg_advisory_xact_lock/);
assert.match(sql.wallet, /ghc_membership_purchase:/);
assert.match(sql.wallet, /ghc_claim_pending:/);
assert.match(sql.wallet, /SET search_path = pg_catalog, public, pg_temp/);

assert.match(sql.messaging, /read_receipts_enabled/);
assert.match(sql.messaging, /search_vector/);
assert.match(sql.messaging, /gh_conversation_nicknames/);
assert.match(sql.messaging, /left_at IS NULL/);
assert.match(sql.messaging, /SET search_path\s*=\s*pg_catalog, public, pg_temp/);

assert.match(sql.a2u, /FULL_KYC_RECIPIENT_ATTESTATION_REQUIRED/);
assert.match(sql.a2u, /PAYMENT_OR_RECIPIENT_ALREADY_COUNTED/);
assert.match(sql.a2u, /provider_metadata::text\) <= 16384/);
assert.match(sql.a2u, /REVOKE ALL ON FUNCTION public\.gh_pi_a2u_qualification_summary\(\) FROM PUBLIC,anon,authenticated/);
assert.match(sql.a2u, /SET search_path\s*=\s*pg_catalog, public, pg_temp/);

for (const [name, source] of Object.entries(sql)) {
  const paths = definer(source);
  if (name !== 'membership') assert.ok(paths.length > 0, `${name}: expected SECURITY DEFINER functions`);
  for (const p of paths) assert.match(p, /^pg_catalog,\s*public,\s*pg_temp/i, `${name}: unsafe search_path ${p}`);
}

assert.match(phase4, /gh_session_issue_with_cap/);
assert.match(phase4, /gh_messaging_group_create_from_dm/);
assert.match(phase4, /gh_messaging_group_create_from_dm\(text,text,text,text,text\[\],text\)/);
assert.match(phase4, /uq_gh_conversations_creator_request/);
assert.match(phase4, /gh_messaging_sync_member_count/);
assert.match(phase4, /gh_social_notification_create/);
assert.match(phase4, /gh_messaging_group_invite_respond/);
assert.match(phase4, /gh_messaging_share_own_contact/);
assert.match(phase4, /gh_community_member_directory/);
assert.match(phase4, /gh_conversation_invites_no_client/);
assert.match(phase4, /REVOKE ALL ON FUNCTION public\.gh_messaging_group_create_from_dm/);
assert.match(phase4, /REVOKE ALL ON FUNCTION public\.gh_community_member_directory/);
assert.doesNotMatch(phase4, /GRANT EXECUTE ON FUNCTION public\.gh_(?:session_issue_with_cap|messaging_group_create_from_dm|messaging_group_invite_respond|messaging_share_own_contact|community_member_directory)[^;]* TO authenticated/i);
assert.equal(fs.readdirSync(dir).some((name) => name.includes('20261118_phase4_identity_group_contact')), false);
console.log('PASS held-migration source safety: 6/6 existing migrations inspected + Phase 4 proposal ACL/dependency review');
console.log('PASS wallet payout cancellation preserves Run 291 provider-evidence release boundary');
console.log('PASS marketplace variant transition refuses inventory underflow');
console.log('PASS all SECURITY DEFINER routines use pinned search_path');
console.log('LIMITATION PostgreSQL integration/clean-database rehearsal is still required before application');
