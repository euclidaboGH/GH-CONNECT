#!/usr/bin/env node
/** Runtime tests for safe metadata URL parsing and retry timeout cleanup. */
import assert from 'node:assert/strict'
import { resolveSafeMetadataBase } from '../lib/safe-metadata-base.ts'
import { withRetry } from '../lib/network-resilience.ts'

assert.equal(resolveSafeMetadataBase(undefined), undefined)
assert.equal(resolveSafeMetadataBase('not a valid URL %%%'), undefined)
assert.equal(resolveSafeMetadataBase('javascript:alert(1)'), undefined)
assert.equal(resolveSafeMetadataBase('https://user:secret@example.com/path?q=1#hash'), undefined)
assert.equal(resolveSafeMetadataBase('https://example.com/path?q=1#hash')?.href, 'https://example.com/')
assert.equal(resolveSafeMetadataBase('example.com')?.href, 'https://example.com/')

const originalSetTimeout = globalThis.setTimeout
const originalClearTimeout = globalThis.clearTimeout
const activeTimers = new Set()
globalThis.setTimeout = ((callback, delay, ...args) => {
  let handle
  handle = originalSetTimeout(() => {
    activeTimers.delete(handle)
    callback(...args)
  }, delay)
  activeTimers.add(handle)
  return handle
})
globalThis.clearTimeout = ((handle) => {
  activeTimers.delete(handle)
  return originalClearTimeout(handle)
})

try {
  const value = await withRetry(async () => 'ok', { timeoutMs: 100, maxRetries: 0 })
  assert.equal(value, 'ok')
  assert.equal(activeTimers.size, 0, 'successful requests must not leave timeout timers behind')

  let calls = 0
  const recovered = await withRetry(async () => {
    calls++
    if (calls === 1) throw new TypeError('Failed to fetch')
    return 'recovered'
  }, { timeoutMs: 100, maxRetries: 1, initialDelayMs: 0 })
  assert.equal(recovered, 'recovered')
  assert.equal(calls, 2)
  assert.equal(activeTimers.size, 0, 'retry completion must not leave timeout timers behind')

  await assert.rejects(
    withRetry(() => new Promise(() => {}), { timeoutMs: 10, maxRetries: 0 }),
    /Request timeout/
  )
  assert.equal(activeTimers.size, 0, 'timed-out requests must release their timeout handle')
} finally {
  globalThis.setTimeout = originalSetTimeout
  globalThis.clearTimeout = originalClearTimeout
  for (const timer of activeTimers) originalClearTimeout(timer)
}

console.log('Phase 9 runtime resilience tests: 9 assertions passed')
