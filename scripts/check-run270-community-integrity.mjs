#!/usr/bin/env node
/** Run #270: community UX, chat-access boundary and platform API regression gate. */
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
const read = (path) => readFileSync(path, 'utf8')
const card = read('components/ghc/group-card.tsx')
const hub = read('components/ghc/premium-community-hub.tsx')
const chat = read('app/api/communities/[id]/chat/route.ts')
const posts = read('app/api/communities/[id]/posts/route.ts')
const platform = read('app/api/communities/[id]/platform/route.ts')
const migration = read('supabase/migrations/20261110182120_community_chat_membership_revocation_and_reconciliation.sql')
const searchMigration = read('supabase/migrations/20261110183004_community_server_filter_search_reconciliation.sql')
const communityListRoute = read('app/api/communities/route.ts')
const header = read('components/ghc/collapsing-app-header.tsx')
const communitiesScreen = read('components/ghc/communities-screen.tsx')
const appShell = read('components/ghc/app.tsx')
const pkg = JSON.parse(read('package.json'))
const checks = [
  ['community cards use semantic article containers', /<article className/.test(card)],
  ['community open action is a real button', /<button[\s\S]*?onClick=\{onClick\}/.test(card)],
  ['community card no longer uses a clickable div role=button wrapper', !/role="button"/.test(card)],
  ['join CTA remains an independent control', /onClick=\{onJoin\}/.test(card)],
  ['invitation accept and decline remain independent controls', /onAcceptInvite\(\)/.test(card) && /onDeclineInvite\(\)/.test(card)],
  ['per-card minute timers are removed', !/setInterval/.test(card)],
  ['activity dates use the viewer locale', /toLocaleDateString\(undefined/.test(card)],
  ['member counts are finite and non-negative', /Number\.isFinite\(memberCount\)[\s\S]*?Math\.max\(0/.test(card)],
  ['board, chat and fallback unread counters are independently bounded', /safeBoardUnread[\s\S]*?safeChatUnread[\s\S]*?safeUnreadCount/.test(card)],
  ['community open action has visible keyboard focus', /focus-visible:ring-2/.test(card)],
  ['shared expanded app header is semantic and not a nested banner landmark', /<header[\s\S]*?id=\"gh-main-header\"/.test(header) && !/role=\"banner\"/.test(header)],
  ['collapsed duplicate header controls are hidden and inert', /aria-hidden={!compact \|\| hidden}/.test(header) && /inert={!compact \|\| hidden}/.test(header) && /inert={compact}/.test(header)],
  ['community scroll content drives shared header collapse', /onScroll=\{onHeaderScroll\}/.test(communitiesScreen) && /CollapsingAppHeader/.test(communitiesScreen)],
  ['global bottom navigation is removed from accessibility and focus when hidden', /aria-hidden={bottomNavHidden \|\| showCreateHub}/.test(appShell) && /inert={bottomNavHidden \|\| showCreateHub}/.test(appShell)],
  ['global bottom navigation exposes current page and safe-area spacing', /aria-current={isActive \? \"page\" : undefined}/.test(appShell) && /env\(safe-area-inset-bottom/.test(appShell)],
  ['chat access requires active community membership', /community\.isJoined/.test(hub) && /chatState\?\.chatMember/.test(hub)],
  ['chat access requires chat to be enabled', /chatState\?\.enabled/.test(hub)],
  ['community membership alone no longer grants chat UI access', /const effectiveCanChat = !!community\.isJoined && !!canChat && !!chatState\?\.enabled && !!chatState\?\.chatMember/.test(hub)],
  ['chat state is cleared while authoritative membership is rechecked', /setChatState\(null\)/.test(hub)],
  ['stale chat-state responses are ignored', /chatStateRequestRef\.current/.test(hub)],
  ['chat state fetch explicitly includes session credentials', /credentials: "include"/.test(hub)],
  ['chat GET sanitizes and bounds community IDs', /sanitizeCommunityId\(id\)/.test(chat) && /1,160/.test(chat)],
  ['chat POST rejects malformed and unknown actions instead of treating them as join', /body\.action != null && typeof body\.action !== "string"/.test(chat) && /INVALID_ACTION/.test(chat) && /new Set\(\["create", "review", "join"\]\)/.test(chat)],
  ['chat approval requires an explicit boolean decision', /APPROVAL_DECISION_REQUIRED/.test(chat) && /typeof body\.approve !== "boolean"/.test(chat)],
  ['chat responses are private and non-cacheable', /no-store, private/.test(chat) && /Vary: "Cookie, Authorization"/.test(chat)],
  ['community post route uses the shared ID sanitizer', /sanitizeCommunityId\(id\)/.test(posts)],
  ['community post IDs use the shared 160-character boundary', /1,160/.test(posts)],
  ['community post responses are private and non-cacheable', /no-store, private/.test(posts)],
  ['platform route applies private no-store response headers', /const NO_STORE = \{ "Cache-Control": "no-store, private"/.test(platform)],
  ['announcement payloads have bounded text and an allow-listed type', /INVALID_ANNOUNCEMENT/.test(platform) && /5000/.test(platform)],
  ['events require a positive chronological duration', /endsAt <= startsAt/.test(platform)],
  ['event virtual links require credential-free HTTPS', /safeHttpsUrl\(body\.virtualLink\)/.test(platform) && /url\.protocol !== "https:"/.test(platform)],
  ['resource URLs allow safe same-origin paths but reject unsafe schemes and protocol-relative URLs', /safeResourceUrl\(body\.url\)/.test(platform) && /text\.startsWith\("\/\/"\)/.test(platform) && /url\.username \|\| url\.password/.test(platform)],
  ['reports use allow-listed target and reason values', /INVALID_REPORT/.test(platform) && /misinformation/.test(platform)],
  ['moderator member-removal targets are bounded', /boundedText\(body\.targetUserId, 160, true\)/.test(platform)],
  ['community join serializes against leave and chat access transitions', /gh_community_join[\s\S]*?FOR UPDATE/.test(migration)],
  ['community leave serializes on the community row', /gh_community_leave[\s\S]*?FOR UPDATE/.test(migration)],
  ['community leave revokes the separate conversation membership', /gh_community_leave[\s\S]*?UPDATE public\.gh_conversation_members[\s\S]*?left_at = COALESCE/.test(migration)],
  ['moderator removal revokes the separate conversation membership', /gh_community_member_remove[\s\S]*?UPDATE public\.gh_conversation_members[\s\S]*?left_at = COALESCE/.test(migration)],
  ['chat requests are cancelled or declined when access is revoked', /status = 'cancelled'[\s\S]*?status IN \('pending', 'approved'\)/.test(migration) && /status = 'declined'/.test(migration)],
  ['chat state requires active community membership as well as conversation membership', /SELECT v_member AND EXISTS/.test(migration)],
  ['stale active community-chat grants are reconciled', /UPDATE public\.gh_conversation_members cm[\s\S]*?NOT EXISTS \([\s\S]*?m\.status = 'active'/.test(migration)],
  ['rejoining a community does not silently rejoin its chat channel', /Deliberately do not restore gh_conversation_members/.test(migration)],
  ['privileged community RPCs remain service-role only', /REVOKE ALL ON FUNCTION public\.gh_community_leave[\s\S]*?FROM PUBLIC, anon, authenticated/.test(migration) && /GRANT EXECUTE ON FUNCTION public\.gh_community_leave[\s\S]*?TO service_role/.test(migration)],
  ['patched database functions pin search_path', (migration.match(/SET search_path = pg_catalog, public/g) || []).length === 4],
  ['community discovery search migration is canonical and present', existsSync('supabase/migrations/20261110183004_community_server_filter_search_reconciliation.sql')],
  ['public community search excludes private and deleted communities', /c\.privacy = 'public'/.test(searchMigration) && /c\.deleted_at IS NULL/.test(searchMigration)],
  ['community search pagination has bounded limit and offset', /least\(greatest\(coalesce\(p_limit, 50\), 1\), 100\)/.test(searchMigration) && /least\(greatest\(coalesce\(p_offset, 0\), 0\), 100000\)/.test(searchMigration)],
  ['community search RPC is service-role-only with fixed search_path', /REVOKE ALL ON FUNCTION public\.gh_community_search_public[\s\S]*?FROM PUBLIC;[\s\S]*?REVOKE ALL ON FUNCTION public\.gh_community_search_public[\s\S]*?FROM anon, authenticated/.test(searchMigration) && /GRANT EXECUTE ON FUNCTION public\.gh_community_search_public[\s\S]*?TO service_role/.test(searchMigration) && /SET search_path = pg_catalog, public/.test(searchMigration)],
  ['community directory route calls the server-side search RPC with category and pagination', /gh_community_search_public/.test(communityListRoute) && /p_category: category/.test(communityListRoute) && /p_offset: offset/.test(communityListRoute)],
  ['community search indexes match public category and text-search paths', /idx_gh_communities_public_category_created/.test(searchMigration) && /idx_gh_communities_public_search/.test(searchMigration)],
  ['community integrity gate is registered in prebuild and static verification', (pkg.scripts['prebuild:checks'].match(/check-run270-community-integrity\.mjs/g) || []).length === 1 && (pkg.scripts['verify:static'].match(/check-run270-community-integrity\.mjs/g) || []).length === 1],
  ['Run #270 audit report exists', existsSync('docs/RUN270-COMMUNITY-30-POINT-AUDIT.md')],
]
let failed = 0
for (const [label, pass] of checks) { console.log(`${pass ? 'PASS' : 'FAIL'} ${label}`); if (!pass) failed++ }
console.log(`\nRun #270 community integrity: ${checks.length - failed}/${checks.length} passed`)
assert.equal(failed, 0, 'Run #270 community integrity gate failed')
