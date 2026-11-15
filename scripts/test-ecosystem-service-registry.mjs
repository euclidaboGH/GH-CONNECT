#!/usr/bin/env node
import assert from 'node:assert/strict'
import { ECOSYSTEM_SERVICES, SERVICE_CATEGORIES, isInteractiveStatus } from '../lib/navigation/service-registry.ts'
import { getEcosystemServiceAccess } from '../lib/server/ecosystem/service-release.ts'

assert.equal(SERVICE_CATEGORIES.length, 9, 'all nine ecosystem categories remain registered')
assert.equal(ECOSYSTEM_SERVICES.length, 41, 'all 41 services remain registered')
assert.equal(new Set(ECOSYSTEM_SERVICES.map((service) => service.id)).size, 41, 'service IDs are unique')

const active = ECOSYSTEM_SERVICES.filter((service) => service.status === 'ACTIVE')
const beta = ECOSYSTEM_SERVICES.filter((service) => service.status === 'BETA')
const comingSoon = ECOSYSTEM_SERVICES.filter((service) => service.status === 'COMING_SOON')
const unavailable = ECOSYSTEM_SERVICES.filter((service) => service.status === 'UNAVAILABLE')
assert.equal(active.length, 11, 'the eleven released services remain active')
assert.equal(beta.length, 0, 'no service is silently promoted to beta')
assert.equal(comingSoon.length, 30, 'all thirty planned services remain Coming Soon')
assert.equal(unavailable.length, 0, 'no existing service is silently disabled')

for (const service of comingSoon) {
  assert.equal(isInteractiveStatus(service.status), false, `${service.id} must remain non-interactive`)
  assert.deepEqual(service.destination, { kind: 'none' }, `${service.id} must not expose a live destination`)
  assert.deepEqual(getEcosystemServiceAccess(service.id), { allowed: false, serviceId: service.id, reason: 'SERVICE_NOT_RELEASED' }, `${service.id} server API gate must fail closed`)
}
for (const service of active) {
  assert.equal(isInteractiveStatus(service.status), true, `${service.id} remains interactive`)
  assert.notEqual(service.destination.kind, 'none', `${service.id} retains its canonical destination`)
  assert.equal(getEcosystemServiceAccess(service.id).allowed, true, `${service.id} server API gate remains open`)
}
assert.deepEqual(getEcosystemServiceAccess('unknown-service'), { allowed: false, serviceId: 'unknown-service', reason: 'UNKNOWN_SERVICE' })

for (const service of ECOSYSTEM_SERVICES) {
  assert.ok(SERVICE_CATEGORIES.some((category) => category.id === service.category), `${service.id} has a valid category`)
  assert.ok(service.title.trim().length > 0, `${service.id} has a display title`)
}

console.log('Ecosystem service registry: 41 services / 9 categories / 11 Active / 30 Coming Soon — all checks passed')
