#!/usr/bin/env node
/** RUN374: harden remaining authenticated and operator mutation boundaries found in Phase 3. */
import { readFileSync } from 'node:fs'
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const edit = read('app/api/social/posts/[id]/edit/route.ts')
const announcements = read('app/api/system/announcements/route.ts')
const settle = read('app/api/social/posts/[id]/ghpv/settle/route.ts')
const announcementsRate = /checkDurableRateLimit\(\"announcement-publish:operator\", 10, 60_000/.test(announcements) && /checkDurableRateLimit\(`announcement-read:\$\{auth\.userId\}`, 60, 60_000/.test(announcements)
const key = read('lib/server/security/operator-key.ts')
const checks = [
  ['post edits require a durable per-user rate limit', /checkDurableRateLimit\(`social-post-edit:\$\{auth\.userId\}`, 20, 60_000, \{ onUnavailable: "deny" \}\)/.test(edit)],
  ['post edit throttling occurs after session authentication and before body parsing', edit.indexOf('resolveAuthenticatedUser') < edit.indexOf('checkDurableRateLimit') && edit.indexOf('checkDurableRateLimit') < edit.indexOf('const parsedBody = await readBoundedJson')],
  ['post edit GET lookup has a 10-second deadline', /signal: AbortSignal\.timeout\(10_000\)/.test(edit)],
  ['post edit PATCH has a 10-second deadline', (edit.match(/signal: AbortSignal\.timeout\(10_000\)/g) || []).length === 2],
  ['post edit maps upstream lookup and write failures to no-store 503 responses', /POST_LOOKUP_UNAVAILABLE/.test(edit) && /EDIT_UNAVAILABLE/.test(edit) && /Cache-Control": "no-store"/.test(edit)],
  ['announcement publishing uses the shared operator-key verifier', /operatorKeyAuthorized\(request/.test(announcements) && /GREENHAVEN_ANNOUNCEMENT_ADMIN_KEY/.test(announcements)],
  ['announcement publishing has a dedicated header and 32-byte minimum', /x-greenhaven-announcement-key/.test(announcements) && /OPERATOR_KEY_MIN_BYTES/.test(announcements)],
  ['announcement publishing no longer uses direct string equality', !/suppliedAdminKey\s*===\s*configuredAdminKey/.test(announcements)],
  ['announcement publish and user read mutations use durable scoped rate limits', announcementsRate],
  ['announcement Supabase requests have a finite 10-second deadline', /signal: AbortSignal\.timeout\(10_000\)/.test(announcements)],
  ['GHPV settlement uses the shared operator-key verifier', /operatorKeyAuthorized\(request/.test(settle)],
  ['GHPV settlement requires the shared 32-byte minimum', /OPERATOR_KEY_MIN_BYTES/.test(settle) && /GH_SETTLEMENT_INTERNAL_KEY/.test(settle)],
  ['shared verifier hashes both values before constant-time comparison', /timingSafeEqual\(digest\(supplied\), digest\(expected\)\)/.test(key)],
  ['GHC ledger and GHPV settlement do not mint from votes', /Does not mint GHC/.test(settle)],
]
let failed = 0
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failed++ }
console.log(`\nRUN374 API hardening: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
