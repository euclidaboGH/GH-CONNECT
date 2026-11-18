#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read = (path) => readFileSync(path, 'utf8')
const hub = read('components/ghc/premium-community-hub.tsx')
const card = read('components/ghc/enhanced-post-card.tsx')
const readOnlyCard = read('components/ghc/community-read-only-post-card.tsx')
const canonicalCard = read('components/ghc/community-canonical-post-card.tsx')
const announcement = read('components/ghc/community-features-ui.tsx')
const governanceStore = read('lib/server/community/governance-store.ts')
const governanceAdapter = read('lib/domains/adapters/community-governance.ts')
const reportsRoute = read('app/api/governance/reports/route.ts')
const moderationRoute = read('app/api/governance/moderation-log/route.ts')
const context = read('contexts/ghc-context.tsx')
const pkg = JSON.parse(read('package.json'))
const checks = [
  ['archived community board posts use the canonical read-only post renderer', /CommunityReadOnlyPostCard[\s\S]*?statusLabel=\{p\.pinned \? "Archived · pinned · read-only"/.test(hub)],
  ['sample previews use the canonical read-only post renderer', /statusLabel="Preview · join to participate"/.test(hub)],
  ['legacy discussion posts use the same canonical read-only renderer', /<CommunityReadOnlyPostCard[\s\S]*?Archived · read-only/.test(hub)],
  ['read-only post mode suppresses post menus and action mutations', /readOnly\?: boolean/.test(card) && /!readOnly \? <ActionSheet/.test(card) && /!readOnly \? <>[\s\S]*?<PostActionBar/.test(card)],
  ['read-only post mode suppresses reward and engagement roster panels', /!readOnly \? <>[\s\S]*?<PostRewardPanel[\s\S]*?<EngagementRosterSheet/.test(card)],
  ['read-only post wrapper never wires social write handlers', /onComment=\{noMutation\}/.test(readOnlyCard) && /onShare=\{noMutation\}/.test(readOnlyCard) && /onSave=\{noMutation\}/.test(readOnlyCard)],
  ['read-only historical polls and challenges cannot accept votes or joins', /PollInline poll=\{pollView\} postId=\{post\.id\} readOnly=\{readOnly\}/.test(card) && /ChallengeInline challenge=\{ch\} readOnly=\{readOnly\}/.test(card) && /disabled=\{readOnly \|\| busy/.test(readFileSync('components/ghc/poll-inline.tsx', 'utf8')) && /readOnly \? \(/.test(readFileSync('components/ghc/challenge-inline.tsx', 'utf8'))],
  ['pinned community posts sort ahead of other discussions', /const pinned = Number\(Boolean\(b\.pinned\)\) - Number\(Boolean\(a\.pinned\)\)/.test(hub)],
  ['Top sort uses reactions, comments and shares rather than likes alone', /mode === "top"[\s\S]*?engagementScore\(b\) - engagementScore\(a\)/.test(hub) && /2 \* Math\.max[\s\S]*?3 \* Math\.max/.test(hub)],
  ['Hot sort includes time decay and differs from Top', /mode === "hot"[\s\S]*?Math\.pow\([\s\S]*?0\.7/.test(hub)],
  ['announcement cards use a restrained semantic article layout and all announcements remain visible', /<article className=\{`rounded-2xl border p-3\.5/.test(announcement) && /Pinned/.test(announcement) && /const sortedAnnouncements = \[\.\.\.announcements\]\.sort/.test(hub) && /sortedAnnouncements\.map/.test(hub)],
  ['canonical community posts expose report-to-moderator using the canonical community RPC', /onReport=\{\(postId, reason, details\)/.test(canonicalCard) && /socialCommunityPlatformAction\(communityId, \"report_create\"/.test(canonicalCard) && /result\.durable !== true/.test(canonicalCard) && /communityId=\{community\.id\}/.test(hub)],
  ['moderation reads use canonical gh_community tables, not legacy ghc tables', /gh_community_moderation_log\?community_id/.test(governanceStore) && /gh_community_reports\?community_id/.test(governanceStore) && !/ghc_community_(moderation_log|reports)\?/.test(governanceStore)],
  ['moderation writes use the server role-rechecking append RPC', /rpc\/gh_community_moderation_log_append/.test(governanceStore)],
  ['report resolution waits for durable server acknowledgement before local state changes', /await fetch\("\/api\/governance\/reports"[\s\S]*?payload\.durable !== true[\s\S]*?sessionUpdateReport/.test(governanceAdapter)],
  ['report resolution validates its own payload without requiring create-only target fields', /if \(payload\.action === "resolve"\)[\s\S]*?const reportId = id\(report\.id\)[\s\S]*?const targetType = id\(report\.targetType/.test(reportsRoute)],
  ['moderation and report endpoints are private no-store responses and reject malformed top-level JSON', /Cache-Control": "no-store, private"/.test(reportsRoute) && /Cache-Control": "no-store, private"/.test(moderationRoute) && /const body = parsed.value[\s\S]*?typeof body !== "object"/.test(reportsRoute) && /const body = parsed.value[\s\S]*?typeof body !== "object"/.test(moderationRoute)],
  ['moderation writes fail closed when durable rate limiting is unavailable', /governance\/reports:POST"[\s\S]*?failClosed: true/.test(reportsRoute) && /governance\/moderation-log:POST"[\s\S]*?failClosed: true/.test(moderationRoute)],
  ['report creation does not mirror a second duplicate session report after durable success', !/createCommunityReport\(/.test(context)],
  ['moderator report actions are disabled while a decision is pending', /reportActionBusy !== null/.test(hub) && /updateReportStatus\(r\.id, "resolved"\)/.test(hub)],
  ['community pagination and completion gates are registered in all required checks', (pkg.scripts['pretypecheck'].match(/check-phase4-community-post-pagination\.mjs/g) || []).length === 1 && (pkg.scripts['prebuild:checks'].match(/check-phase4-community-post-pagination\.mjs/g) || []).length === 1 && (pkg.scripts['verify:static'].match(/check-phase4-community-post-pagination\.mjs/g) || []).length === 1],
]
let failed = 0
for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) failed++ }
console.log(`Phase 4 community completion: ${checks.length - failed}/${checks.length} checks passed`)
assert.equal(failed, 0, 'Phase 4 community completion gate failed')
