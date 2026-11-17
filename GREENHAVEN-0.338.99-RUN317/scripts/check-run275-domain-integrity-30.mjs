#!/usr/bin/env node
/** Run 275: curation / A2U / auth / withdraw auth / rewards / payments / profile / posts (30). */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const root = path.join(fileURLToPath(new URL('..', import.meta.url)))
const r = (p) => fs.readFileSync(path.join(root, p), 'utf8')
const e = (p) => fs.existsSync(path.join(root, p))
let pass = 0, fail = 0
const ok = (n, c) => { if (c) { pass++; console.log('PASS', n) } else { fail++; console.error('FAIL', n) } }
const pkg = JSON.parse(r('package.json'))
const cat = r('lib/integrity/domain-upgrades-0.338.36.ts')
const cur = r('lib/curation/client-curation-guards.ts')
const wchk = r('lib/wallet/withdrawal-authorization-checklist.ts')
const pay = r('lib/payments/pipeline-contracts.ts')
const auth = r('lib/auth/session-integrity-snapshot.ts')
const rew = r('lib/rewards/claim-events.ts')
const prof = r('lib/profile/public-projection-guards.ts')
const eng = r('lib/engagement/post-engagement-contracts.ts')
const res = r('lib/wallet/withdrawal-reservation-policy.ts')
const hi = e('lib/security/high-risk-controls-0.338.17.ts') ? r('lib/security/high-risk-controls-0.338.17.ts') : ''
const postCard = r('components/ghc/enhanced-post-card.tsx')
const rewards = r('components/ghc/rewards-centre-screen.tsx')
const withdraw = e('components/ghc/pi-withdraw-sheet.tsx') ? r('components/ghc/pi-withdraw-sheet.tsx') : ''

ok('01 current package retains Run 275 domain integrity baseline', pkg.version.localeCompare('0.338.40', undefined, { numeric: true }) >= 0)
ok('02 domain upgrade count 30', /DOMAIN_UPGRADE_COUNT = 30/.test(cat))
ok('03 curation self vote client guard', /isSelfCuration/.test(cur))
ok('04 curation debounce 400', /CURATION_UI_DEBOUNCE_MS = 400/.test(cur))
ok('05 curation humanize errors', /humanizeCurationError/.test(cur))
ok('06 nextCurationChoice toggle', /nextCurationChoice/.test(cur))
ok('07 post card imports curation guards', /client-curation-guards/.test(postCard))
ok('08 reserve on quote false', /RESERVE_ON_QUOTE = false/.test(res))
ok('09 reserve on consent false', /RESERVE_ON_CONSENT = false/.test(res))
ok('10 reserve on accepted payout true', /RESERVE_ON_ACCEPTED_PAYOUT_REQUEST = true/.test(res))
ok('11 withdraw auth checklist builder', /buildWithdrawalAuthorizationChecklist/.test(wchk))
ok('12 withdraw pin check in checklist', /id: "pin"/.test(wchk))
ok('13 withdraw identity map check', /identity_map/.test(wchk))
ok('14 withdraw sheet imports checklist', /withdrawal-authorization-checklist/.test(withdraw))
ok('15 session max default 8', /SESSION_MAX_ACTIVE_DEFAULT = 8/.test(auth))
ok('16 step-up likely for withdraw', /stepUpLikelyRequiredForWithdraw: true/.test(auth))
ok('17 payment mutation timeout 45s', /PAYMENT_MUTATION_TIMEOUT_MS = 45_000/.test(pay))
ok('18 payment commission 500 bps', /MARKETPLACE_COMMISSION_BPS = 500/.test(pay))
ok('19 payment credentials include', /PAYMENT_CREDENTIALS/.test(pay))
ok('20 rewards claim events', /REWARD_CLAIMED_EVENT/.test(rew) && /WALLET_REFRESH_EVENT/.test(rew))
ok('21 emitRewardClaimed helper', /export function emitRewardClaimed/.test(rew))
ok('22 rewards centre uses emit', /emitRewardClaimed/.test(rewards))
ok('23 profile strip financial fields', /stripFinancialFieldsFromPublicProfile/.test(prof))
ok('24 profile forbidden balance keys', /piBalance/.test(prof) && /ghcBalance/.test(prof))
ok('25 post engagement event contract', /POST_ENGAGEMENT_EVENT = "ghc:post-engagement"/.test(eng))
ok('26 production not approved high-risk', !hi || /PRODUCTION_RELEASE_APPROVED = false/.test(hi))
ok('27 A2U quote does not reserve catalog', /A2U_QUOTE_DOES_NOT_RESERVE = true/.test(cat))
ok('28 rewards missions server authoritative', /REWARDS_MISSIONS_SERVER_AUTHORITATIVE = true/.test(cat))
ok('29 profile no blob publish flag', /PROFILE_NO_BLOB_PUBLISH = true/.test(cat))
ok('30 post curation server counts flag', /POST_CURATION_USES_SERVER_COUNTS = true/.test(cat))

console.log(`\nRun 275 domain integrity 30: ${pass}/${pass + fail}`)
process.exit(fail ? 1 : 0)
