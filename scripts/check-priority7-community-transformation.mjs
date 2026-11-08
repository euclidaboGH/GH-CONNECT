#!/usr/bin/env node
/** Priority 7 Communities transformation: actionable participation focus and honest governance/resource identity. */
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
const read = (path) => readFileSync(path, 'utf8')
const screen = read('components/ghc/communities-screen.tsx')
const governance = read('lib/domains/adapters/community-governance-store.ts')
const participation = read('lib/domains/adapters/community-participation-hub.ts')
const resourceCard = read('components/ghc/community-features-ui.tsx')
const pkg = JSON.parse(read('package.json'))
const lock = JSON.parse(read('package-lock.json'))
const checks = [
  ['Community pulse Board action filters to communities with board updates', screen.includes('communityAttentionFilter === "board"') && screen.includes('Number(c.boardUnread || 0) <= 0')],
  ['Community pulse Chat action filters to communities with unread chat', screen.includes('communityAttentionFilter === "chat"') && screen.includes('Number(c.chatUnread || c.unreadCount || 0) <= 0')],
  ['Community pulse Requests action is restricted to moderator roles with pending requests', screen.includes('communityAttentionFilter === "requests"') && screen.includes('["owner", "admin", "moderator"].includes(role)') && screen.includes('c.pendingJoinRequests?.length')],
  ['Pulse focus controls expose selected state and can be cleared', (screen.match(/aria-pressed=\{communityAttentionFilter ===/g) || []).length === 3 && screen.includes('Clear focus') && screen.includes('setCommunityAttentionFilter("all")')],
  ['Attention focus participates in memo dependencies', screen.includes('sortBy, communityAttentionFilter])')],
  ['Governance feature flag never masquerades as durable persistence', governance.includes('return "session"') && governance.includes('Session-only until server persistence is confirmed') && !governance.includes('"Server-backed governance log"')],
  ['Legacy event rows receive deterministic fallback IDs', participation.includes('const fallbackId = `evt_${index}_${startsAt}_') && !/Math\.random/.test(participation)],
  ['Event URLs and resource URLs share an HTTPS/relative-path allowlist', participation.includes('safeCommunityResourceUrl(source.virtualLink || source.link)') && participation.includes('url: safeCommunityResourceUrl(source.url)') && participation.includes('parsed.protocol !== "https:"')],
  ['Resource normalizer tolerates missing rows and validates sort order', participation.includes('const source = r && typeof r === "object" ? r : {}') && participation.includes('Number.isFinite(Number(source.order))')],
  ['Raw event and resource card URLs are sanitized at the rendering boundary', resourceCard.includes('safeCommunityResourceUrl(event.virtualLink)') && resourceCard.includes('safeCommunityResourceUrl(resource.url)') && resourceCard.includes('href={safeVirtualLink}') && resourceCard.includes('href={safeResourceUrl}')],
  ['Community resource links retain safe external-link isolation', resourceCard.includes('target="_blank"') && resourceCard.includes('rel="noopener noreferrer"')],
  ['Priority 7 regression gate is registered exactly once in prebuild and static verification', (pkg.scripts.prebuild.match(/check-priority7-community-transformation\.mjs/g) || []).length === 1 && (pkg.scripts['verify:static'].match(/check-priority7-community-transformation\.mjs/g) || []).length === 1],
  ['Release metadata is aligned across package, lockfile and app release', lock.version === pkg.version && lock.packages[''].version === pkg.version && read('lib/app-release.ts').includes(`APP_RELEASE_VERSION = "${pkg.version}"`)],
]
let failed = 0
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failed++ }
assert.equal(failed, 0, `${failed} Priority 7 Community checks failed`)
console.log(`Priority 7 Communities transformation: ${checks.length}/${checks.length} passed`)
