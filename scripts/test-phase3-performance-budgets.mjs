import assert from 'node:assert/strict'
import * as B from '../lib/performance-budgets.ts'
let passed = 0
const check = (n, f) => { f(); passed++; console.log(`PASS ${n}`) }

check('CWV thresholds rate correctly', () => {
  assert.equal(B.rateVital('LCP', 2500), 'good'); assert.equal(B.rateVital('LCP', 2501), 'needs-improvement'); assert.equal(B.rateVital('LCP', 4001), 'poor')
  assert.equal(B.rateVital('INP', 200), 'good'); assert.equal(B.rateVital('INP', 501), 'poor')
  assert.equal(B.rateVital('CLS', 0.1), 'good'); assert.equal(B.rateVital('CLS', 0.26), 'poor')
})
check('invalid vitals fail closed to poor', () => { for (const v of [NaN, -1, Infinity]) assert.equal(B.rateVital('LCP', v), 'poor') })
check('percentile nearest-rank', () => {
  assert.equal(B.percentile([1,2,3,4], 75), 3); assert.equal(B.percentile([], 75), null); assert.equal(B.percentile([5], 0), null)
  assert.equal(B.percentile([10, NaN, 20], 100), 20)
})
check('budget verdict never passes on too few samples', () => {
  const v = B.evaluateSurfaceBudget('feed', 'LCP', [100, 200], 30); assert.equal(v.withinBudget, null)
})
check('budget verdict pass/fail at p75', () => {
  const good = Array.from({ length: 40 }, () => 1800), bad = Array.from({ length: 40 }, () => 3200)
  assert.equal(B.evaluateSurfaceBudget('feed', 'LCP', good).withinBudget, true)
  assert.equal(B.evaluateSurfaceBudget('feed', 'LCP', bad).withinBudget, false)
})
check('CLS uses max session window, ignores input-driven shifts', () => {
  const shifts = [{ startTime: 100, value: 0.05 }, { startTime: 600, value: 0.04 }, { startTime: 9000, value: 0.2 }, { startTime: 9100, value: 0.5, hadRecentInput: true }]
  assert.equal(Math.round(B.computeCls(shifts) * 100) / 100, 0.2)
  assert.equal(B.computeCls([]), 0)
})
check('CLS window splits on >1s gap and >5s span', () => {
  assert.equal(B.computeCls([{ startTime: 0, value: 0.1 }, { startTime: 1500, value: 0.1 }]), 0.1)
  const long = [0,900,1800,2700,3600,4500,5400].map((t) => ({ startTime: t, value: 0.01 }))
  assert.ok(B.computeCls(long) < 0.07 && B.computeCls(long) >= 0.05)
})
check('INP picks worst for few interactions', () => { assert.equal(B.computeInp([40, 180, 90]), 180); assert.equal(B.computeInp([]), null) })
check('surface mapping ignores query/hash and unknown tabs', () => {
  assert.equal(B.surfaceFromPath('/'), 'home'); assert.equal(B.surfaceFromPath('/privacy?token=abc'), 'legal')
  assert.equal(B.surfaceFromPath('/api/users/12345'), 'other'); assert.equal(B.surfaceFromPath('/', 'feed'), 'feed'); assert.equal(B.surfaceFromPath('/', 'matches'), 'matches'); assert.equal(B.surfaceFromPath('/', '../etc'), 'home')
})
check('device and connection buckets are coarse', () => {
  assert.equal(B.classifyDevice(2, 8), 'low'); assert.equal(B.classifyDevice(undefined, undefined), 'unknown'); assert.equal(B.classifyDevice(8, 8), 'high'); assert.equal(B.classifyDevice(4, 6), 'standard')
  assert.equal(B.classifyConnection('4g'), 'fast'); assert.equal(B.classifyConnection('4g', true), 'slow'); assert.equal(B.classifyConnection('weird'), 'unknown')
})
check('validator accepts clean batch and re-rates server-side', () => {
  const r = B.validateRumBatch({ samples: [{ name: 'LCP', value: 3000.4, rating: 'good', surface: 'feed', device: 'low', connection: 'slow' }] })
  assert.ok(r.ok); assert.equal(r.samples[0].rating, 'needs-improvement'); assert.equal(r.samples[0].value, 3000)
})
check('validator drops unknown/PII keys', () => {
  const r = B.validateRumBatch({ samples: [{ name: 'CLS', value: 0.05, surface: 'feed', url: 'https://x/?t=1', userId: 'u1', device: 'x', connection: 'y' }] })
  assert.ok(r.ok); assert.deepEqual(Object.keys(r.samples[0]).sort(), ['connection', 'device', 'name', 'rating', 'surface', 'value']); assert.equal(r.samples[0].device, 'unknown')
})
check('validator rejects bad input', () => {
  for (const bad of [null, {}, { samples: [] }, { samples: Array(31).fill({}) }, { samples: [{ name: 'FID', value: 1, surface: 'feed' }] },
    { samples: [{ name: 'LCP', value: -1, surface: 'feed' }] }, { samples: [{ name: 'LCP', value: 1e9, surface: 'feed' }] },
    { samples: [{ name: 'LCP', value: 1, surface: '/user/123' }] }, { samples: ['x'] }])
    assert.equal(B.validateRumBatch(bad).ok, false)
  const validSample = { name: 'LCP', value: 900, surface: 'feed' }
  assert.equal(B.validateRumBatch({ samples: Array(18).fill(validSample) }).ok, true)
  assert.equal(B.validateRumBatch({ samples: Array(31).fill(validSample) }).ok, false)
})
check('sampling is off by default and fails closed', () => {
  assert.equal(B.parseSampleRate(undefined), 0); assert.equal(B.parseSampleRate('abc'), 0); assert.equal(B.parseSampleRate('-1'), 0); assert.equal(B.parseSampleRate('5'), 1); assert.equal(B.parseSampleRate('0.1'), 0.1)
  assert.equal(B.shouldSample(0, 0), false); assert.equal(B.shouldSample(0.1, 0.05), true); assert.equal(B.shouldSample(0.1, 0.5), false); assert.equal(B.shouldSample(1, NaN), false)
})
console.log(`${passed}/${passed} passed`)
