import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import assert from 'node:assert/strict'
const root = process.cwd()
const migration = readFileSync(join(root,'supabase/migrations/20261023020001_gh_notification_realtime_event_platform.sql'),'utf8')
const bell = readFileSync(join(root,'components/ghc/notification-bell.tsx'),'utf8')
const api = readFileSync(join(root,'app/api/notifications/route.ts'),'utf8')
const realtime = readFileSync(join(root,'app/api/realtime/events/route.ts'),'utf8')
const recovery = readFileSync(join(root,'lib/realtime/recovery.ts'),'utf8')
const tests = [
 ['unified notification inbox table', /CREATE TABLE IF NOT EXISTS public\.gh_notification_inbox/.test(migration)],
 ['durable realtime event journal', /CREATE TABLE IF NOT EXISTS public\.gh_realtime_events/.test(migration)],
 ['notification dedupe constraint', /uq_gh_notification_inbox_recipient_dedupe/.test(migration)],
 ['notification cursor pagination', /p_before_created_at timestamptz.*p_before_id text/s.test(migration)],
 ['notification unread count RPC', /gh_notification_inbox_unread_count/.test(migration)],
 ['notification read RPC', /gh_notification_inbox_mark_read/.test(migration)],
 ['legacy social backfill', /FROM public\.gh_social_notifications/.test(migration)],
 ['legacy economy backfill', /FROM public\.ghc_economy_events/.test(migration)],
 ['social automatic projection trigger', /trg_gh_social_notification_v2_projection/.test(migration)],
 ['economy automatic projection trigger', /trg_gh_economy_notification_v2_projection/.test(migration)],
 ['unified notification API', /listUnifiedNotifications/.test(api) && /NextResponse/.test(api)],
 ['unified authenticated read marking', /resolveAuthenticatedUser/.test(api) && /markUnifiedNotificationsRead/.test(api)],
 ['realtime recovery API', /gh_realtime_events/.test(realtime) && /afterSequence/.test(realtime)],
 ['realtime recovery cursor', /lastSequence/.test(recovery)],
 ['realtime recovery publishes remote events', /domainEvents\.publishRemote/.test(recovery)],
 ['notification bell unified source', /\/api\/notifications\?limit=80/.test(bell)],
 ['notification bell unified read path', /fetch\("\/api\/notifications"/.test(bell)],
 ['reconnect invokes recovery', /recoverRealtimeEvents\(\)/.test(readFileSync(join(root,'lib/realtime/transport-bridge.ts'),'utf8'))],
 ['canonical installer contains migration', /20261023020001_gh_notification_realtime_event_platform\.sql/.test(readFileSync(join(root,'supabase/GREENHAVEN-CANONICAL-SUPABASE-INSTALL.sql'),'utf8'))],
 ['migration inventory has 131', readdirSync(join(root,'supabase/migrations')).filter(n=>/^\d{14}_.+\.sql$/.test(n)).length === 131],
]
let pass=0
for (const [name, ok] of tests) { if (!ok) { console.log('FAIL',name); process.exitCode=1 } else { console.log('PASS',name); pass++ } }
console.log(`PHASE 32 NOTIFICATION + REALTIME: ${pass}/${tests.length}`)
if (pass !== tests.length) process.exit(1)
