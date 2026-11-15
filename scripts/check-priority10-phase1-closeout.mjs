import fs from 'node:fs'
import assert from 'node:assert/strict'
const migration = fs.readFileSync('supabase/migrations/20261109100001_gh_messaging_phase1_controls_search.sql','utf8')
const prefs = fs.readFileSync('app/api/messaging/conversations/[conversationId]/prefs/route.ts','utf8')
const search = fs.readFileSync('app/api/messaging/conversations/[conversationId]/search/route.ts','utf8')
const screen = fs.readFileSync('components/ghc/message-screen.tsx','utf8')
const messageRoute = fs.readFileSync('app/api/messaging/conversations/[conversationId]/messages/route.ts','utf8')
const manifest = fs.readFileSync('scripts/generate-migration-inventory.mjs','utf8')
const integration = fs.readFileSync('supabase/tests/phase1_messaging_membership_acceptance.sql','utf8')
const store = fs.readFileSync('lib/server/messaging/message-store.ts','utf8')
const checks = [
 ['conversation nicknames are actor-to-target scoped', /gh_conversation_nicknames[\s\S]*actor_id text NOT NULL[\s\S]*target_user_id text NOT NULL/.test(migration)],
 ['nickname target must be an active member', /p_target_user_id[\s\S]*left_at IS NULL/.test(migration)],
 ['nickname values are bounded', /char_length\(trim\(nickname\)\) BETWEEN 1 AND 48/.test(migration)],
 ['quick reaction and read receipt preferences are durable per member', /quick_reaction text NOT NULL DEFAULT/.test(migration) && /read_receipts_enabled boolean NOT NULL DEFAULT true/.test(migration)],
 ['read receipt opt-out suppresses receipt rows but retains read cursor', /IF coalesce\(v_receipts_enabled, true\) THEN/.test(migration) && /SET last_read_at = v_now/.test(migration)],
 ['settings writes use authenticated actor and service-role-only RPC', /resolveAuthenticatedUser/.test(prefs) && /gh_set_conversation_controls/.test(prefs) && /GRANT EXECUTE[\s\S]*TO service_role/.test(migration)],
 ['settings reads use membership-checked RPC', /gh_get_conversation_controls/.test(prefs) && /left_at IS NULL/.test(migration)],
 ['message edit endpoint dispatches durable edit contract', /editMessage\(/.test(messageRoute) && /gh_edit_message/.test(fs.readFileSync('lib/server/messaging/message-store.ts','utf8'))],
 ['message pin endpoint dispatches durable pin contract', /pinMessage\(/.test(messageRoute) && /gh_pin_message/.test(fs.readFileSync('lib/server/messaging/message-store.ts','utf8'))],
 ['full-history search uses generated tsvector and GIN index', /GENERATED ALWAYS AS \(to_tsvector/.test(migration) && /USING gin \(search_vector\)/.test(migration)],
 ['search RPC enforces active membership and excludes deleted messages', /gh_search_conversation_messages[\s\S]*left_at IS NULL[\s\S]*deleted_at IS NULL/.test(migration)],
 ['search result size and offset are bounded', /least\(greatest\(coalesce\(p_limit, 30\), 1\), 50\)/.test(migration) && /least\(greatest\(coalesce\(p_offset, 0\), 0\), 1000\)/.test(migration)],
 ['search API derives actor from session and rate limits', /resolveAuthenticatedUser/.test(search) && /checkDurableRateLimit/.test(search)],
 ['search API rejects malformed query and paging parameters', /INVALID_SEARCH_PARAMS/.test(search)],
 ['active message UI queries server history instead of local-only filter', /\/api\/messaging\/conversations\/\$\{encodeURIComponent\(selectedId\)\}\/search/.test(screen) && /Searches indexed message history on the server/.test(screen)],
 ['new migration is classified REVIEW_REQUIRED, not auto-approved', /20261109100001_gh_messaging_phase1_controls_search\.sql/.test(manifest)],
 ['Testnet acceptance fixture verifies active member and outsider search behavior', /Active member full-history search failed/.test(integration) && /Outsider search was not rejected/.test(integration)],
 ['Testnet acceptance fixture verifies nickname, read receipt, edit and pin boundaries', /INVALID_NICKNAME_TARGET/.test(integration) && /Read receipt was written after opt-out/.test(integration) && /Non-sender edit was not rejected/.test(integration) && /Outsider pin was not rejected/.test(integration)],
 ['production edit/pin RPC failures fail closed', /if \(isProd\(\)\) return \{ ok: false, error: \"EDIT_FAILED\" \}/.test(store) && /if \(isProd\(\)\) return \{ ok: false, error: \"PIN_FAILED\" \}/.test(store)],
]
for (const [name, ok] of checks) { assert.equal(ok,true,name); console.log(`PASS ${name}`) }
console.log(`\n${checks.length}/${checks.length} Phase 1 closeout checks passed`)
