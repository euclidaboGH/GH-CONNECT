#!/usr/bin/env node
/** Static regression checks for realtime transport trust boundaries. */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8')
const bus = read('lib/realtime/event-bus.ts')
const transport = read('lib/realtime/transport-bridge.ts')
const packageJson = JSON.parse(read('package.json'))
const workflow = read('.github/workflows/ci.yml')
let passed = 0
let failed = 0
function check(ok, label) {
  if (ok) { passed++; console.log(`  PASS ${label}`) }
  else { failed++; console.error(`  FAIL ${label}`) }
}

console.log('\n=== REALTIME TRANSPORT HARDENING ===\n')
check(bus.includes('const DOMAIN_EVENT_TYPE_SET: ReadonlySet<string>'), 'event bus has an explicit runtime allowlist')
const unionBlock = bus.match(/export type DomainEventType =([\s\S]*?)\n\n\/\*\* Runtime counterpart/)?.[1] || ''
const declaredTypes = [...unionBlock.matchAll(/\|\s*"([A-Z0-9_]+)"/g)].map((m) => m[1])
const runtimeBlock = bus.match(/const DOMAIN_EVENT_TYPE_SET: ReadonlySet<string> = new Set\(\[([\s\S]*?)\]\)/)?.[1] || ''
const runtimeTypes = [...runtimeBlock.matchAll(/"([A-Z0-9_]+)"/g)].map((m) => m[1])
check(declaredTypes.length > 0 && declaredTypes.length === runtimeTypes.length && declaredTypes.every((type) => runtimeTypes.includes(type)), 'runtime allowlist covers every declared event type exactly')
check(bus.includes('export function isDomainEventType(value: unknown)'), 'event type validation helper is exported')
check(transport.includes('isDomainEventType(e.type)'), 'remote events reject unknown event types')
check(transport.includes('SERVER_AUTHORITATIVE_EVENT_TYPES.has(e.type)'), 'remote events cannot assert financial/payment outcomes')
check(transport.includes('PAYMENT_COMPLETED') && transport.includes('WALLET_BALANCE_UPDATED') && transport.includes('REWARD_EARNED'), 'server-authoritative financial event families are explicitly blocked from realtime input')
check(transport.includes('Array.isArray(data)'), 'remote event envelope rejects arrays')
check(transport.includes('e.actorId.trim().length === 0') && transport.includes('e.actorId.length > 128'), 'remote event requires a bounded non-empty actor ID')
check(transport.includes('!Number.isFinite(e.at)') && transport.includes('e.at <= 0'), 'remote event requires a finite positive timestamp')
check(transport.includes('e.requestId.length > 128'), 'remote request IDs are length bounded')
check(transport.includes('MAX_EVENT_JSON'), 'remote event payload has a hard byte-character ceiling')
check(transport.includes('this.ws.readyState === WebSocket.CONNECTING') && transport.includes('if (this.retryTimer) return'), 'duplicate connection attempts are suppressed')
check(packageJson.scripts?.['test:realtime-transport-hardening'] === 'node scripts/test-realtime-transport-hardening.mjs', 'package test command is registered')
check(packageJson.scripts?.['ci:verify']?.includes('test:realtime-transport-hardening'), 'full CI verification includes this regression test')
check(workflow.includes('for test_file in scripts/test-*.mjs') && workflow.includes('node "$test_file"'), 'CI executes every regression script, including this one')

console.log(`\nREALTIME TRANSPORT HARDENING: ${passed}/${passed + failed}`)
if (failed) process.exit(1)
console.log('REALTIME TRANSPORT HARDENING PASSED\n')
