import fs from 'node:fs'
import assert from 'node:assert/strict'
const actions = fs.readFileSync('lib/notification-actions.ts', 'utf8')
const bell = fs.readFileSync('components/ghc/notification-bell.tsx', 'utf8')
const route = fs.readFileSync('app/api/notifications/route.ts', 'utf8')
const dismissHandler = bell.split('const onDelete = (n: Notification) => {')[1]?.split('const markAll = async () => {')[0] || ''
const checks = [
  ['standard action identifiers are explicit', /"open" \| "mark_read" \| "dismiss" \| "retry"/.test(actions)],
  ['contextual labels derive from destination metadata', actions.includes('View transaction') && actions.includes('Review transfer') && actions.includes('Open message')],
  ['dismiss copy accurately describes device-local scope', actions.includes('Hide this notification on this device')],
  ['dismiss does not mutate the durable read state', dismissHandler.includes('deleteNotification?.(n.id)') && dismissHandler.includes('setItems((prev) => prev.filter') && !dismissHandler.includes('markOneRead(n)')],
  ['retry is only offered when the caller confirms a failed action', actions.includes('if (options.retryAvailable)')],
  ['notification UI renders the shared action contract', bell.includes('resolveNotificationActions(expanded')],
  ['mark-read failures expose a retry action', bell.includes('setFailedActionId(n.id)') && bell.includes('action.id === "retry"')],
  ['failed action state resets on account switch', bell.includes('setFailedActionId(null)') && bell.includes('setStatusMsg(null)')],
  ['server notification mutation remains authenticated', route.includes('resolveAuthenticatedUser(request.headers)')],
  ['no client-side dismiss/delete server endpoint was introduced', !fs.existsSync('app/api/notifications/dismiss/route.ts')],
]
for (const [name, ok] of checks) { assert.ok(ok, name); console.log(`PASS ${name}`) }
console.log(`Phase 11.2.1 source contracts: ${checks.length}/${checks.length} passed`)
