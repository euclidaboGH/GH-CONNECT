import fs from 'node:fs'

const read = (file) => fs.readFileSync(file, 'utf8')
const checks = [
  ['revenue summary imports its SHA-256 implementation', /import \{ createHash \} from "node:crypto"/.test(read('app/api/admin/revenue-summary/route.ts'))],
  ['field evidence queue rows declare created_at', /type EvidenceQueueBase[\s\S]*created_at: string/.test(read('app/api/field/admin/evidence/route.ts'))],
  ['scanner distinguishes research and field evidence rows', /type ResearchEvidenceRow[\s\S]*type FieldEvidenceRow/.test(read('app/api/internal/evidence/scan-queue/route.ts'))],
  ['scanner narrows storage fields by evidence type', /row\.evidence_type === "research" \? row\.storage_bucket/.test(read('app/api/internal/evidence/scan-queue/route.ts'))],
  ['evidence completion routes avoid duplicate ok properties', !/\{\s*ok:\s*true,\s*\.\.\.result\s*\}/.test(['app/api/field/reports/[id]/evidence/complete/route.ts','app/api/field/reports/[id]/evidence/intent/route.ts','app/api/research/public/[slug]/evidence/complete/route.ts','app/api/research/public/[slug]/evidence/intent/route.ts'].map(read).join('\n'))],
  ['public research idempotency fallback narrows REST result', /fallbackResponse\?\.ok \? fallbackResponse\.data\[0\]/.test(read('app/api/research/public/[slug]/route.ts'))],
  ['challenge RPC errors are narrowed before data access', /if \(!joined\.ok\)[\s\S]*if \(joined\.data\?\.ok !== true\)/.test(read('app/api/social/challenges/route.ts'))],
  ['challenge durable ID is initialized before its effect', /const durableId[\s\S]*useEffect\(\(\) => \{/.test(read('components/ghc/challenge-inline.tsx'))],
  ['touch lists are accessed through the DOM TouchList API', /e\.touches\.item\(/.test(read('components/ghc/enhanced-feed-screen.tsx'))],
  ['daily claim adapter implements text and JSON readers', /text: async \(\) => JSON\.stringify\(rpcResult\.ok \? rpcResult\.data : rpcResult\.body\)/.test(read('lib/server/economy/db.ts'))],
  ['REST results preserve response headers', /ok: true; data: T; status: number; headers: Headers/.test(read('lib/server/supabase/rest-client.ts'))],
  ['REST response byte cap is enforced while streaming', /maxResponseBytes[\s\S]*total > maxResponseBytes[\s\S]*SUPABASE_REST_RESPONSE_TOO_LARGE/.test(read('lib/server/supabase/rest-client.ts'))],
  ['profile hydration uses a 1 MiB upstream response cap', /maxResponseBytes: 1024 \* 1024/.test(read('lib/server/identity/public-profile-hydration.ts'))],
  ['Pioneer count reads the actual content-range response header', /res\.headers\.get\("content-range"\)/.test(read('lib/server/engagement/pioneer-activity.ts'))],
  ['evidence fallback lookups narrow failed REST results', (read('lib/server/evidence/scoped-upload.ts').match(/fallback\?\.ok \? fallback\.data\[0\]/g) || []).length === 2],
  ['achievement logging uses the in-scope result status', /unlock failed", result\.status/.test(read('lib/server/identity/achievement-store.ts'))],
  ['push RPC payloads are narrowed as unknown objects', /const data = result\.data[\s\S]*const envelope = data && typeof data === "object" && !Array\.isArray\(data\)/.test(read('lib/server/notifications/push-architecture.ts'))],
  ['unified notification RPC payloads are narrowed as unknown objects', /const envelope = data && typeof data === "object" && !Array\.isArray\(data\)/.test(read('lib/server/notifications/unified.ts'))],
  ['referral RPC payloads are narrowed before record access', /result\.data && typeof result\.data === "object" && !Array\.isArray\(result\.data\)/.test(read('lib/server/referral/referral-service.ts'))],
  ['operator identity count uses canonical REST transport', /supabaseRest<unknown\[]>\("gh_pi_identities\?select=gh_user_id"/.test(read('lib/server/operator/pi-listing-readiness.ts'))],
]
let failed = 0
for (const [label, passed] of checks) {
  console.log(`${passed ? 'PASS' : 'FAIL'} ${label}`)
  if (!passed) failed++
}
console.log(`Run #312 TypeScript repair contract: ${checks.length - failed}/${checks.length}`)
if (failed) process.exit(1)
