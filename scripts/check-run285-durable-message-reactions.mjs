import fs from 'node:fs'
import assert from 'node:assert/strict'
const route = fs.readFileSync('app/api/messaging/conversations/[conversationId]/messages/route.ts', 'utf8')
const store = fs.readFileSync('lib/server/messaging/message-store.ts', 'utf8')
const domain = fs.readFileSync('lib/domains/messaging-domain.ts', 'utf8')
const migration = fs.readFileSync('supabase/migrations/20261111131500_run285_durable_message_reactions.sql', 'utf8')
const checks = [
  ['reaction mutation is exported from the server store', /export async function toggleMessageReaction/.test(store)],
  ['server validates a strict reaction allowlist', /const allowed = new Set\(\["❤️", "👍", "😂", "😮", "😢", "🙏", "🔥", "🎉"\]\)/.test(store)],
  ['actor identity is supplied by authenticated route context', /actorId: auth\.userId/.test(route)],
  ['route has an authenticated reaction mutation branch', /body\?\.reaction/.test(route) && /toggleMessageReaction/.test(route)],
  ['durable mode persists reactions through server API', /reaction: i\.emoji\.trim\(\)/.test(domain) && /isDurableMessagingEnabled\(\)/.test(domain)],
  ['message history rehydrates aggregate reaction counts and viewer selections', /gh_message_reactions\?conversation_id/.test(store) && /message\.reactionCounts =/.test(store) && /message\.viewerReactions =/.test(store)],
  ['production cannot silently downgrade reaction writes to memory', /if \(isProd\(\)\) return \{ ok: false, error: "STORE_UNAVAILABLE" \}/.test(store)],
  ['reaction table has RLS enabled and client access revoked', /ENABLE ROW LEVEL SECURITY/.test(migration) && /REVOKE ALL ON TABLE public\.gh_message_reactions FROM PUBLIC, anon, authenticated/.test(migration)],
  ['reaction table enforces one reaction per actor, message and emoji', /PRIMARY KEY \(message_id, actor_id, emoji\)/.test(migration)],
  ['RPC requires active conversation membership', /gh_conversation_members[\s\S]*left_at IS NULL/.test(migration)],
  ['RPC returns aggregate counts and viewer-only selections', /reaction_counts/.test(migration) && /viewer_reactions/.test(migration) && !/jsonb_agg\(actor_id/.test(migration)],
  ['RPC execute is restricted to service role', /REVOKE ALL ON FUNCTION public\.gh_message_toggle_reaction\(text,text,text,text\) FROM PUBLIC, anon, authenticated/.test(migration) && /GRANT EXECUTE ON FUNCTION public\.gh_message_toggle_reaction\(text,text,text,text\) TO service_role/.test(migration)],
  ['migration is documented as unapplied until historical sources reconcile', /has NOT been applied to Testnet/.test(fs.readFileSync('docs/RUN285-SOCIAL-MESSAGING-CLOSEOUT.md','utf8'))],
]
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); assert.ok(ok, label) }
console.log(`Run #285 durable message reaction checks: ${checks.length}/${checks.length} PASS`)
