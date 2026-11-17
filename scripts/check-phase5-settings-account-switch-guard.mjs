import fs from 'node:fs'
import assert from 'node:assert/strict'

const settings = fs.readFileSync('components/ghc/settings.tsx', 'utf8')
const checks = [
  ['notification preference writes capture the active account owner', /const owner = notificationIdentityId/.test(settings)],
  ['stale account interactions are rejected before local mutation', /if \(!owner \|\| owner !== IdentityService\.getCurrentUserId\(\)\) return/.test(settings)],
  ['browser permission completion rechecks account ownership', /if \(!ok \|\| IdentityService\.getCurrentUserId\(\) !== owner\) return/.test(settings)],
  ['permission completion reloads the captured account preference cache', /loadNotificationPreferences\(owner\)/.test(settings)],
  ['local preference writes use captured owner, not mutable active identity', /saveNotificationPreferences\(next, owner\)/.test(settings)],
  ['account switch is checked immediately before state mutation', /if \(IdentityService\.getCurrentUserId\(\) !== owner\) return\s+setNotificationPrefs\(next\)/.test(settings)],
  ['asynchronous server response cannot toast into another account session', /if \(IdentityService\.getCurrentUserId\(\) !== owner\) return\s+if \(!response\.ok/.test(settings)],
  ['network failure feedback is also owner-scoped', /catch\(\(\) => \{\s+if \(IdentityService\.getCurrentUserId\(\) !== owner\) return/.test(settings)],
  ['server remains authoritative for account identity', fs.readFileSync('app/api/notifications/preferences/route.ts', 'utf8').includes('resolveAuthenticatedUser(request.headers)')],
]
for (const [name, ok] of checks) { assert.ok(ok, name); console.log(`PASS ${name}`) }
console.log(`Phase 5 Settings account-switch guard: ${checks.length}/${checks.length} passed`)
