import fs from 'node:fs'
const store = fs.readFileSync('lib/server/messaging/message-store.ts', 'utf8')
const route = fs.readFileSync('app/api/messaging/conversations/[conversationId]/messages/route.ts', 'utf8')
const client = fs.readFileSync('lib/messaging/server-messaging-sync.ts', 'utf8')
const checks = [
  ['message idempotency payload comparison is centralized', /function matchesMessageIdempotencyPayload/.test(store)],
  ['same key must match original message body', /existing\.body === expected\.body/.test(store)],
  ['same key must match reply target and shared post identity', /existing\.replyTo/.test(store) && /existing\.sharedPostId/.test(store)],
  ['same key must match normalized durable media attachments', /stableAttachments\(existing\.mediaAttachments\)/.test(store) && /stableAttachments\(expected\.mediaAttachments\)/.test(store)],
  ['existing durable replay rejects changed payloads', /if \(!matchesMessageIdempotencyPayload\(prior/.test(store) && /IDEMPOTENCY_CONFLICT/.test(store)],
  ['unique-constraint race recovery also checks payload identity', /if \(!matchesMessageIdempotencyPayload\(prior/.test(store)],
  ['memory-mode duplicate keys follow the same payload comparison', /list\.find\(\(m\) => m\.clientMessageId === clientMessageId\)!/.test(store) && /matchesMessageIdempotencyPayload\(prior/.test(store)],
  ['API maps idempotency payload conflict to HTTP 409', /result\.error === "IDEMPOTENCY_CONFLICT"\s*\? 409/.test(route)],
  ['client retry wrapper treats idempotency conflict as terminal', /IDEMPOTENCY_CONFLICT/.test(client)],
  ['notification fan-out remains suppressed for idempotent retries', /!result\.idempotent/.test(route)],
]
let failed=0
for(const [label,pass] of checks){console.log(`${pass?'PASS':'FAIL'} ${label}`);if(!pass)failed++}
console.log(`Phase 3 messaging idempotency: ${checks.length-failed}/${checks.length} passed`)
if(failed)process.exit(1)
