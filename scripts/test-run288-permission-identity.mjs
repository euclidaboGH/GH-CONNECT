import assert from 'node:assert/strict'
import {
  buildPermissionContext,
  canFollow,
  canMessageUser,
  canViewProfile,
} from '../lib/permission-engine.ts'

const actorId = 'authenticated-user-288'
const context = buildPermissionContext({ currentUserId: actorId })

assert.equal(context.currentUserId, actorId, 'permission context must retain the hydrated actor identity')
assert.equal(canViewProfile(context, actorId), true, 'the actor must be able to view their own profile')
assert.equal(canFollow(context, actorId), false, 'the actor must not be able to follow themselves')
assert.equal(canMessageUser(context, actorId), false, 'the actor must not be able to message themselves')
assert.equal(canFollow(context, 'another-user-288'), true, 'an unrelated unblocked user remains followable')

console.log('Run #288 permission identity behavior: 5/5 passed')
