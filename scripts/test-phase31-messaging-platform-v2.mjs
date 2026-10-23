import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (p) => fs.readFileSync(path.join(root,p),'utf8')
const checks = []
const ok = (name, value) => checks.push([name, Boolean(value)])

const migration = read('supabase/migrations/20261023010003_gh_messaging_v2.sql')
const store = read('lib/server/messaging/message-store.ts')
const msgRoute = read('app/api/messaging/conversations/[conversationId]/messages/route.ts')
const orderChat = read('app/api/marketplace/orders/[orderId]/conversation/route.ts')
const marketplace = read('components/ghc/marketplace-screen.tsx')
const sync = read('lib/messaging/server-messaging-sync.ts')

ok('V2 migration exists', migration.includes('gh_messaging_set_conversation_context'))
ok('stable message cursor index', migration.includes('idx_gh_messages_conversation_created_id'))
ok('conversation context fields', migration.includes('context_type') && migration.includes('context_id'))
ok('first-class reply fields', migration.includes('reply_to_message_id'))
ok('first-class shared entity fields', migration.includes('shared_type') && migration.includes('shared_id'))
ok('delivery acknowledgement RPC', migration.includes('gh_messaging_mark_delivered'))
ok('server stable beforeId accepted', msgRoute.includes('beforeId') && msgRoute.includes('beforeId,'))
ok('store uses composite cursor', store.includes('created_at.eq.') && store.includes('id.lt.'))
ok('store hydrates context', store.includes('contextType: row.context_type'))
ok('store hydrates first-class share', store.includes('sharedType: typeof row.shared_type'))
ok('marketplace order chat route', orderChat.includes('loadOrder') && orderChat.includes('setConversationContext'))
ok('marketplace ownership enforced', orderChat.includes('buyerId') && orderChat.includes('sellerId'))
ok('marketplace UI exposes transaction chat', marketplace.includes('/conversation') && marketplace.includes('Chat'))
ok('client cursor remains compatible', sync.includes('apiListMessages') && sync.includes('before?: string | number'))

const failed = checks.filter(([,v]) => !v)
console.log(`PHASE 31 MESSAGING PLATFORM V2: ${checks.length-failed.length}/${checks.length} PASS`)
for (const [n,v] of checks) console.log(`${v?'PASS':'FAIL'} ${n}`)
if (failed.length) process.exit(1)
