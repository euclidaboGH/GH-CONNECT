#!/usr/bin/env node
import assert from 'node:assert/strict'
import { ECOSYSTEM_SERVICES } from '../lib/navigation/service-registry.ts'
import { runOptionalEcosystemProvider } from '../lib/server/ecosystem/optional-provider.ts'

let initialized = false
const unreleased = ECOSYSTEM_SERVICES.find((service) => service.status === 'COMING_SOON')
assert.ok(unreleased, 'fixture includes an unreleased service')
const blocked = await runOptionalEcosystemProvider(unreleased.id, async () => {
  initialized = true
  return 'must-not-run'
})
assert.deepEqual(blocked, {
  ok: false,
  serviceId: unreleased.id,
  reason: 'SERVICE_NOT_RELEASED',
})
assert.equal(initialized, false, 'unreleased provider callback must never initialize')

const active = ECOSYSTEM_SERVICES.find((service) => service.status === 'ACTIVE')
assert.ok(active, 'fixture includes a released service')
const successful = await runOptionalEcosystemProvider(active.id, async () => 'ready')
assert.deepEqual(successful, { ok: true, serviceId: active.id, value: 'ready' })

const failed = await runOptionalEcosystemProvider(active.id, async () => {
  throw new Error('private provider failure')
})
assert.deepEqual(failed, {
  ok: false,
  serviceId: active.id,
  reason: 'PROVIDER_FAILURE',
}, 'optional provider exceptions are contained')

const unknown = await runOptionalEcosystemProvider('not-a-real-service', async () => {
  initialized = true
  return 'must-not-run'
})
assert.deepEqual(unknown, {
  ok: false,
  serviceId: 'not-a-real-service',
  reason: 'UNKNOWN_SERVICE',
})
assert.equal(initialized, false, 'unknown providers must never initialize')

console.log('Optional provider isolation: 4 scenarios passed; unreleased providers remain unloaded and failures contained')
