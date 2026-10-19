import fs from 'node:fs'
import assert from 'node:assert/strict'

const migration = fs.readFileSync('supabase/migrations/202610250001_gh_system_announcements.sql', 'utf8')
const route = fs.readFileSync('app/api/system/announcements/route.ts', 'utf8')
const bell = fs.readFileSync('components/ghc/notification-bell.tsx', 'utf8')

assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.gh_system_announcements/i)
assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.gh_system_announcement_reads/i)
assert.match(migration, /ENABLE ROW LEVEL SECURITY/i)
assert.match(migration, /USING \(false\) WITH CHECK \(false\)/i)
assert.match(migration, /CHECK \(action_path IS NULL OR \(left\(action_path, 1\) = '\/' AND left\(action_path, 2\) <> '\/\/'\)\)/i)
assert.match(route, /resolveAuthenticatedUser\(request\.headers\)/)
assert.match(route, /gh_user_id=eq\.\$\{encodeURIComponent\(auth\.userId\)\}/)
assert.match(route, /GREENHAVEN_ANNOUNCEMENT_ADMIN_KEY/)
assert.match(route, /body\.markAll === true/)
assert.match(route, /published_at=lte\./)
assert.match(route, /expires_at\.gt\./)
assert.match(route, /INVALID_ACTION_PATH/)
assert.match(bell, /\/api\/system\/announcements\?limit=25/)
assert.match(bell, /durableAnnouncement: true/)
assert.match(bell, /\/api\/system\/announcements/)
assert.match(bell, /announcementUnread/)
console.log('System announcement source checks: 15/15 passed')
