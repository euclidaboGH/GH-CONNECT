#!/usr/bin/env node
/** Phase 8: verified, durable, non-financial mission achievement contract. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = join(fileURLToPath(new URL('..', import.meta.url)))
const read = (name) => readFileSync(join(root, name), 'utf8')
const route = read('app/api/economy/missions/progress/route.ts')
const sql = read('supabase/migrations/20261106170001_phase8_verified_mission_achievements.sql')
const client = read('lib/missions/progress.ts')
const pkg = JSON.parse(read('package.json'))
const lock = JSON.parse(read('package-lock.json'))
const release = read('lib/app-release.ts')
const roadmap = read('docs/PRODUCT-ROADMAP.md')
const migrationGenerator = read('scripts/generate-migration-inventory.mjs')
const checks = [
  ['Mission route derives actor from verified server authentication', route.includes('resolveAuthenticatedUser(req.headers)') && route.includes('auth.userId')],
  ['Mission route rejects unauthenticated requests', route.includes('AUTH_REQUIRED') && route.includes('401')],
  ['Mission route uses durable fail-closed rate limiting', route.includes('checkDurableRateLimit') && route.includes('onUnavailable: "deny"')],
  ['Mission request body is bounded', route.includes('readBoundedJson(req, 4096)')],
  ['Mission codes are allow-listed', route.includes('const ALLOWED = new Set(') && route.includes('INVALID_MISSION')],
  ['Client-supplied metadata is ignored', route.includes('void parsed.value.meta')],
  ['Mission persistence is performed through the canonical service-role RPC', route.includes('socialRpc("gh_rewards_mission_complete"')],
  ['Missing verifier returns a no-store 503 without granting value', route.includes('MISSION_VERIFICATION_UNAVAILABLE') && route.includes('grantedGhc: 0')],
  ['SQL verifier has SECURITY DEFINER and fixed search_path', sql.includes('SECURITY DEFINER') && sql.includes('SET search_path = pg_catalog, public')],
  ['SQL verifier has a fixed seven-mission allowlist', ['join_community','first_post','first_comment','meaningful_contribution','complete_profile','send_connection','accept_connection'].every((code) => sql.includes(`'${code}'`))],
  ['Community mission checks active membership and non-deleted community', sql.includes('gh_community_members') && sql.includes("m.status = 'active'") && sql.includes('c.deleted_at IS NULL')],
  ['Post mission checks authored, non-deleted post', sql.includes('public.gh_posts p') && sql.includes('p.author_id = v_user') && sql.includes('p.deleted_at IS NULL')],
  ['Comment mission checks authored comment and live parent post', sql.includes('public.gh_post_comments c') && sql.includes('c.author_id = v_user') && sql.includes('JOIN public.gh_posts p ON p.id = c.post_id')],
  ['Meaningful contribution verifies either a live post or a live comment', sql.includes("WHEN 'meaningful_contribution' THEN") && sql.includes('OR EXISTS (SELECT 1 FROM public.gh_post_comments c')],
  ['Rewards challenge cards do not advertise disabled mission GHC amounts', !/challenge\.rewardAmount|\+\{challenge\.rewardAmount\}/.test(read('components/ghc/rewards-centre-screen.tsx')) && !/\+\{rule\.amount\}/.test(read('components/ghc/rewards-centre-screen.tsx'))],
  ['Challenge engine never labels local mission progress as credited or held GHC', read('lib/domains/reward-challenges.ts').includes('Progress target met — verify achievement against your account') && read('lib/domains/reward-challenges.ts').includes('Progress target met — verify against GreenHaven records') && !read('lib/domains/reward-challenges.ts').includes('Credited — open Wallet for ledger')],
  ['Rewards challenge cards expose server verification for supported milestones', read('components/ghc/rewards-centre-screen.tsx').includes('Verify achievement') && read('components/ghc/rewards-centre-screen.tsx').includes('reportMissionProgress(code)')],
  ['Mission verification feedback is visibly and accessibly announced', read('components/ghc/rewards-centre-screen.tsx').includes('role="status" aria-live="polite"') && read('components/ghc/rewards-centre-screen.tsx').includes('Achievement verified and saved to your account')],
  ['Wallet, onboarding, settings and Pi capability copy does not promise mission GHC', !/missions, and activity credits/.test(read('features/wallet/add-ghc-sheet.tsx')) && !/claims, referrals, missions/.test(read('components/ghc/pi-connected-badge.tsx')) && read('components/ghc/onboarding.tsx').includes('mission milestones unlock achievements, not GHC') && read('components/ghc/settings.tsx').includes('Missions & daily claims') && read('lib/server/pi/platform-capabilities.ts').includes('mission achievements are non-financial')],
  ['Profile mission checks durable onboarded profile and display name', sql.includes('public.gh_user_profiles p') && sql.includes('p.onboarded = true') && sql.includes('p.display_name')],
  ['Connection missions verify actor direction and accepted/pending status with a fail-closed optional-table guard', sql.includes("to_regclass('public.ghc_connection_requests') IS NULL") && sql.includes("r.from_user_id = $1") && sql.includes("r.to_user_id = $1") && sql.includes("r.status IN (''pending'', ''accepted'')")],
  ['Outgoing connection mission is reported only after durable server request succeeds', (() => { const adapter = read('lib/domains/adapters/unified-connection-request.ts'); const durable = adapter.indexOf('if (res.ok && data?.durable === true)'); const report = adapter.indexOf('reportMissionProgress("send_connection")'); return durable >= 0 && report > durable && adapter.includes('must not delay the request UI') })()],
  ['Mission claim uses advisory transaction lock', sql.includes('pg_advisory_xact_lock(hashtext(')],
  ['Achievement insert is idempotent on canonical unique key', sql.includes('ON CONFLICT (gh_user_id, achievement_id) DO NOTHING')],
  ['Achievement unlock is non-financial and reports zero GHC', sql.includes("'grantedGhc', 0") && sql.includes("'rewardStatus', 'achievement_only'")],
  ['Function execution is restricted to service_role', sql.includes('REVOKE ALL ON FUNCTION public.gh_rewards_mission_complete(text, text) FROM PUBLIC, anon, authenticated') && sql.includes('GRANT EXECUTE ON FUNCTION public.gh_rewards_mission_complete(text, text) TO service_role')],
  ['Client mission helper exposes verified and reward status safely', client.includes('verified?: boolean') && client.includes('rewardStatus?: string')],
  ['Migration is classified for operator review, not auto-applied', migrationGenerator.includes('20261106170001_phase8_verified_mission_achievements.sql')],
  ['Release package and lock metadata are synchronized', Boolean(pkg.version) && lock.version === pkg.version && lock.packages?.['']?.version === pkg.version && release.includes(`APP_RELEASE_VERSION = "${pkg.version}"`)],
  ['Mission contract is registered exactly once in prebuild and static verification', (pkg.scripts['prebuild:checks'].match(/check-phase8-verified-missions\.mjs/g) || []).length === 1 && (pkg.scripts['verify:static'].match(/check-phase8-verified-missions\.mjs/g) || []).length === 1],
  ['Roadmap places Rewards at Priority 3 and Membership at Priority 4', roadmap.includes('| 3 | **Rewards** |') && roadmap.includes('0.323.0') && roadmap.includes('| 4 | **Membership** |')],
]
let failed = 0
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failed++ }
if (failed) process.exit(1)
console.log(`Phase 8 verified mission contract: ${checks.length}/${checks.length} checks passed.`)
