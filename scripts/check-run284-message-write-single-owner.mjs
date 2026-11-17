import fs from 'node:fs'
import assert from 'node:assert/strict'
const repo = fs.readFileSync('lib/domains/http-repositories.ts', 'utf8')
const domain = fs.readFileSync('lib/domains/messaging-domain.ts', 'utf8')
const route = fs.readFileSync('app/api/messaging/conversations/[conversationId]/messages/route.ts', 'utf8')
const append = repo.slice(repo.indexOf('export function createHttpMessageRepository'), repo.indexOf('export function createHttpConversationRepository'))
const checks = [
  ['domain owns durable message POST through retry wrapper', /apiSendMessageWithRetry/.test(domain)],
  ['HTTP repository append is cache-only', /append: \(conversationId, message\) =>[\s\S]*?byConv\.set\(conversationId, list\)/.test(append) && !/append:[\s\S]*?fireWrite\(cfg, `\/messaging\/conversations/.test(append)],
  ['offline send path remains marked sending for the offline flusher', /status: "sending"/.test(domain) && /offline-message-flush/.test(domain)],
  ['server message endpoint still enforces client-message idempotency contract', /clientMessageId/.test(route) && /appendMessage\(/.test(route)],
  ['server response remains the durable send acknowledgement', /durable !== false/.test(domain)],
]
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); assert.ok(ok, label) }
console.log(`Run #284 single-owner message write: ${checks.length}/${checks.length} PASS`)
