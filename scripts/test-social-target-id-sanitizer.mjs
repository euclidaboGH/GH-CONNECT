#!/usr/bin/env node
/** Runtime regression tests for strict social relationship target IDs. */
import assert from 'node:assert/strict'
import { sanitizeTargetUserId } from '../lib/server/social/relationship-integrity.ts'

const valid = sanitizeTargetUserId('  user-123  ', 'viewer-1')
assert.deepEqual(valid, { ok: true, targetUserId: 'user-123' })
assert.equal(sanitizeTargetUserId(123, 'viewer-1').error, 'TARGET_REQUIRED')
assert.equal(sanitizeTargetUserId({ id: 'user-123' }, 'viewer-1').error, 'TARGET_REQUIRED')
assert.equal(sanitizeTargetUserId(['user-123'], 'viewer-1').error, 'TARGET_REQUIRED')
assert.equal(sanitizeTargetUserId('', 'viewer-1').error, 'TARGET_REQUIRED')
assert.equal(sanitizeTargetUserId(`user\u0000bad`, 'viewer-1').error, 'TARGET_REQUIRED')
assert.equal(sanitizeTargetUserId('u'.repeat(161), 'viewer-1').error, 'TARGET_REQUIRED')
assert.equal(sanitizeTargetUserId('viewer-1', 'viewer-1').error, 'SELF')
assert.equal(sanitizeTargetUserId('demo-account', 'viewer-1').error, 'INVALID_TARGET')
assert.equal(sanitizeTargetUserId('me', 'viewer-1').error, 'INVALID_TARGET')
assert.equal(sanitizeTargetUserId(' user-123 ', 'viewer-1').targetUserId, 'user-123', 'block and follow routes share whitespace normalization')
assert.equal(sanitizeTargetUserId('bad\u007fuser', 'viewer-1').error, 'TARGET_REQUIRED')
console.log('Social target ID sanitizer runtime tests: 12/12 passed')
