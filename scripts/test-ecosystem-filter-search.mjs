import assert from 'node:assert/strict'
import { searchServices } from '../lib/navigation/service-registry.ts'

assert.equal(searchServices('marketplace').some((service) => service.id === 'marketplace'), true)
assert.equal(searchServices('commerce marketplace').some((service) => service.id === 'marketplace'), true)
assert.equal(searchServices('coming soon').every((service) => service.status === 'COMING_SOON'), true)
assert.equal(searchServices('  ').length, 41)
assert.equal(searchServices('a'.repeat(500)).length, 0)
assert.equal(searchServices('GHC rewards').some((service) => service.id === 'rewards'), true)
console.log('Ecosystem directory search tests: 6/6 passed')
