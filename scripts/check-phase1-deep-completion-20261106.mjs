#!/usr/bin/env node
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8')
const migration = read('supabase/migrations/20261106110001_phase1_curation_community_guard_reconciliation.sql')
const hub = read('components/ghc/premium-community-hub.tsx')
const communityScreen = read('components/ghc/communities-screen.tsx')
const canonicalCard = read('components/ghc/community-canonical-post-card.tsx')
const pkg = JSON.parse(read('package.json'))
const checks = [
  ['curation preflight delegates visibility to the canonical post-read policy', /gh_post_viewer_can_read\(v_user,\s*v_post_id\)/.test(migration)],
  ['canonical visibility covers community membership, mutuals, followers and blocks through the shared policy', /same visibility authority as Feed\/Profile/.test(migration)],
  ['self-curation is consistently rejected by preflight', /v_post\.author_id\s*=\s*v_user[\s\S]*?SELF_CURATION_FORBIDDEN/.test(migration)],
  ['daily curation quota is serialized per user before preflight', /gh_curate_daily:[\s\S]*?gh_curation_preflight/.test(migration)],
  ['daily quota remains capped at 120 committed activity events', /v_votes\s*>=\s*120/.test(migration)],
  ['GHPV contribution uses SET semantics through the canonical writer', /gh_ghpv_record_curation_weight\([\s\S]*?v_choice[\s\S]*?v_weight/.test(migration)],
  ['activity audit failure aborts the atomic vote transaction', /v_activity\s*:=\s*public\.gh_curation_activity_record[\s\S]*?IF coalesce\(\(v_activity->>'ok'\)::boolean, false\) IS NOT TRUE THEN\s*RAISE EXCEPTION/.test(migration)],
  ['curation RPC remains service-role-only', /REVOKE ALL ON FUNCTION public\.gh_post_curation_set_with_reward\([\s\S]*?FROM PUBLIC, anon, authenticated[\s\S]*?GRANT EXECUTE ON FUNCTION public\.gh_post_curation_set_with_reward[\s\S]*?TO service_role/.test(migration)],
  ['migration adds no GHC ledger, wallet, Pi or payout mutation', !/INSERT INTO public\.(?:ghc_ledger|ghc_transactions|ghc_user_accounts)|UPDATE public\.(?:ghc_user_accounts|ghc_wallets)|pi_payment|payout_execute/i.test(migration)],
  ['community feed orders by the same millisecond cursor key used in its predicate', /ORDER BY \(extract\(epoch FROM p\.created_at\) \* 1000\)::bigint DESC, p\.id DESC/.test(migration) && /extract\(epoch FROM p\.created_at\) \* 1000\)::bigint < p_before_ms/.test(migration)],
  ['community board keeps last-known-good posts when refresh fails', /if \(result\.ok && result\.durable\)[\s\S]*?setCanonicalBoardPosts\(result\.posts\)[\s\S]*?else \{[\s\S]*?setCanonicalBoardStatus\("unavailable"\)/.test(hub) && !/else\s*setCanonicalBoardPosts\(\[\]\)/.test(hub)],
  ['community board ignores stale in-flight refresh responses', /canonicalBoardRequestRef\.current[\s\S]*?requestId !== canonicalBoardRequestRef\.current/.test(hub)],
  ['community board composer waits for durable post result before clearing draft', /const posted = await onPost\(body, "text"\)[\s\S]*?if \(posted\) setComposeBody/.test(hub)],
  ['community board composer exposes publishing state and prevents duplicate submits', /boardPostBusy[\s\S]*?Publishing…/.test(hub)],
  ['manual board refresh does not remount away the last-known-good posts', /skipHubRemount:\s*true/.test(hub) && /if \(!detail\?\.skipHubRemount\) setHubKey/.test(communityScreen)],
  ['community board displays an honest empty state after a successful empty response', /No discussions yet\. Start the conversation/.test(hub)],
  ['community card save mutation is guarded against duplicate concurrent toggles', /saveBusy[\s\S]*?setSaveBusy\(true\)[\s\S]*?finally\(\(\) => setSaveBusy\(false\)\)/.test(canonicalCard)],
  ['community board parent callback returns an explicit success result', /handleBoardPost = async \([\s\S]*?\): Promise<boolean>[\s\S]*?return true/.test(communityScreen)],
  ['deep completion regression gate is registered in prebuild and static verification', (pkg.scripts['prebuild:checks'] || '').includes('check-phase1-deep-completion-20261106.mjs') && (pkg.scripts['verify:static'] || '').includes('check-phase1-deep-completion-20261106.mjs')],
]
let passed = 0
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  if (ok) passed++
}
console.log(`\nPhase 1 deep completion: ${passed}/${checks.length} passed`)
if (passed !== checks.length) process.exit(1)
