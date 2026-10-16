#!/usr/bin/env node
import fs from 'fs'
import path from 'path'

const root = process.cwd()
const dir = path.join(root, 'app/api/messaging')
const files = []
function walk(d) {
  if (!fs.existsSync(d)) return
  for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, ent.name)
    if (ent.isDirectory()) walk(p)
    else if (ent.name === 'route.ts') files.push(p)
  }
}
walk(dir)

let pass = 0, fail = 0
const issues = []

for (const f of files) {
  const src = fs.readFileSync(f, 'utf8')
  const rel = path.relative(root, f)
  if (rel.includes('/premium/') && /export async function GET/.test(src) && !/POST/.test(src)) {
    pass++; continue
  }
  if (!/resolveAuthenticatedUser/.test(src) && /POST|PATCH|DELETE|GET/.test(src)) {
    // premium GET may be unauthenticated product info
    if (rel.endsWith('premium/route.ts')) { pass++; continue }
    issues.push(`${rel}: missing resolveAuthenticatedUser`)
    fail++; continue
  }
  if (/senderId:\s*body\.|senderId:\s*String\(body/.test(src)) {
    issues.push(`${rel}: sender from body`)
    fail++; continue
  }
  pass++
}

const messages = fs.readFileSync(
  path.join(root, 'app/api/messaging/conversations/[conversationId]/messages/route.ts'),
  'utf8'
)
if (!/senderId: auth\.userId/.test(messages)) {
  issues.push('messages POST: sender not auth.userId'); fail++
} else pass++
if (!/void body\.senderId/.test(messages)) {
  issues.push('messages POST: should void body.senderId'); fail++
} else pass++
if (!/clientMessageId/.test(messages)) {
  issues.push('messages: missing clientMessageId idempotency support'); fail++
} else pass++

const store = fs.readFileSync(path.join(root, 'lib/server/messaging/message-store.ts'), 'utf8')
if (!/isMember/.test(store)) {
  issues.push('message-store: missing isMember'); fail++
} else pass++
if (!/client_message_id/.test(store)) {
  issues.push('message-store: missing client_message_id idempotency'); fail++
} else pass++
if (!/Math\.min\(Math\.max\(input\.limit/.test(store) && !/limit = Math\.min/.test(store)) {
  issues.push('message-store: unbounded listMessages?'); fail++
} else pass++

const bridge = fs.readFileSync(path.join(root, 'lib/realtime/transport-bridge.ts'), 'utf8')
if (!/reconnect|reconcil/.test(bridge)) {
  issues.push('transport-bridge: no reconnect/reconcile'); fail++
} else pass++

console.log(`Messaging authz: ${pass} pass, ${fail} fail (${files.length} routes)`)
if (issues.length) {
  for (const i of issues) console.log(' FAIL', i)
  process.exit(1)
}
console.log('ALL MESSAGING AUTHZ CHECKS PASSED')
