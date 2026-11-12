#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
const root = process.cwd()
const sql = readFileSync(join(root,'docs/proposals/PHASE-I-TRANSACTIONAL-OUTBOX-DESIGN.sql'),'utf8')
const worker = readFileSync(join(root,'lib/server/outbox/transactional-outbox.ts'),'utf8')
const rehearsal = readFileSync(join(root,'supabase/tests/phase1_transactional_outbox_rehearsal.sql'),'utf8')
const checks = [
  ['proposal is explicitly non-deployable until reviewed', /PROPOSAL ONLY/.test(sql) && /SAME transaction/.test(sql)],
  ['outbox has unique event and idempotency identities with payload conflict detection', /unique \(event_id\)/.test(sql) && /unique \(idempotency_key\)/.test(sql) && /OUTBOX_IDEMPOTENCY_CONFLICT/.test(sql)],
  ['payload is constrained to JSON objects', /jsonb_typeof\(payload\) = 'object'/.test(sql)],
  ['claim uses row locks with SKIP LOCKED', /for update skip locked/i.test(sql)],
  ['claims have bounded leases and attempts', /p_lease_seconds not between 10 and 900/.test(sql) && /max_attempts between 1 and 50/.test(sql)],
  ['acknowledgement and failure are fenced by lease token', /lease_token=p_lease_token/.test(sql) && /lease_expires_at > now\(\)/.test(sql)],
  ['retry path has bounded exponential backoff', /least\(3600/.test(sql) && /status='pending'/.test(sql)],
  ['dead-letter and explicit replay preserve event identity', /status='dead'/.test(sql) && /gh_outbox_replay/.test(sql) && /event_id=p_event_id/.test(sql) && /gh_domain_outbox_replay_audit/.test(sql)],
  ['untrusted API roles have no outbox RPC execution', /revoke all on function public\.gh_outbox_claim[\s\S]*?from public, anon, authenticated/.test(sql)],
  ['worker uses privileged server RPC and never performs post-mutation enqueue', /.supabaseServiceRoleKey/.test(worker) && !/rpc(?:<[^>]+>)?\(\s*[\"']gh_outbox_enqueue/.test(worker)],
  ['worker acknowledges with fencing and documents at-least-once semantics', /acknowledgeOutboxEvent/.test(worker) && /heartbeatOutboxLease/.test(worker) && /at-least-once delivery/i.test(worker)],
  ['rehearsal covers rollback, duplicate, lease fencing, dead-letter and replay', ['rollback','idempotent','stale lease','DEAD','replay'].every(x=>rehearsal.toLowerCase().includes(x.toLowerCase()))],
  ['live acceptance runbook exists', existsSync(join(root,'docs/operations/PHASE-I-LIVE-ACCEPTANCE-RUNBOOK.md'))],
]
let failed=0
for (const [name,ok] of checks) { console.log(`${ok?'PASS':'FAIL'} ${name}`); if(!ok) failed++ }
console.log(`\nPhase I outbox contract: ${checks.length-failed}/${checks.length} passed`)
if(failed) process.exit(1)
