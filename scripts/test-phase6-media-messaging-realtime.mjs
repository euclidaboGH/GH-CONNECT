import fs from 'node:fs'
import assert from 'node:assert/strict'

const read = (path) => fs.readFileSync(path, 'utf8')
const messageRoute = read('app/api/messaging/conversations/[conversationId]/messages/route.ts')
const messageStore = read('lib/server/messaging/message-store.ts')
const attachmentValidator = read('lib/server/media/owned-attachment-validation.ts')
const mediaSign = read('app/api/media/[id]/signed-url/route.ts')
const mediaContent = read('app/api/media/[id]/content/route.ts')
const mediaMigration = read('supabase/migrations/20261022010087_gh_private_media_references_and_viewer_authz.sql')
const presenceMigration = read('supabase/migrations/20261022010105_gh_messaging_presence_delivery_receipts.sql')
const realtime = read('lib/realtime/transport-bridge.ts')
const offlineMessages = read('lib/messaging/offline-message-flush.ts')
const pkg = JSON.parse(read('package.json'))
const checks = [
  ['message reads require authenticated session', messageRoute.includes('resolveAuthenticatedUser(request.headers)') && messageRoute.includes('AUTH_REQUIRED')],
  ['message read and send routes disable caching', messageRoute.includes('Cache-Control') && messageRoute.includes('no-store')],
  ['conversation membership gates durable message access', messageStore.includes('if (!(await isMember(cid, uid)))')],
  ['message sends enforce bounded attachment count before persistence', messageRoute.includes('maxItems: 4') && attachmentValidator.includes('raw.length > maxItems')],
  ['message attachment references reject blob/data and arbitrary URLs', attachmentValidator.includes('rawUrl.startsWith("blob:")') && attachmentValidator.includes('rawUrl.startsWith("data:")') && attachmentValidator.includes('^\\/api\\/media\\/')],
  ['message attachments are same-origin first-party media content references', attachmentValidator.includes('url.origin !== requestOrigin') && attachmentValidator.includes('url.protocol !== "https:" && url.protocol !== "http:"') && attachmentValidator.includes('gh_media_authorize_viewer')],
  ['private media authorization uses actual session viewer', mediaSign.includes('p_viewer_id: auth.userId') && mediaSign.includes('gh_media_authorize_viewer')],
  ['signed media links have short five-minute lifetime', mediaSign.includes('expiresIn: 300')],
  ['media content delivery restricts redirect to trusted HTTPS storage origin', mediaContent.includes('signed.protocol !== "https:" || signed.origin !== trustedStorageOrigin')],
  ['media records are referenced by stable IDs and protected by RLS', mediaMigration.includes('CREATE TABLE IF NOT EXISTS public.gh_post_media') && mediaMigration.includes('USING (false) WITH CHECK (false)')],
  ['media visibility is reevaluated against current post/story/message access', mediaMigration.includes('gh_media_authorize_viewer') && mediaMigration.includes('Messages: only current members') && mediaMigration.includes('Stories: audience and expiry')],
  ['presence and receipts are server-owned under RLS', presenceMigration.includes('gh_message_receipts') && presenceMigration.includes('ENABLE ROW LEVEL SECURITY') && presenceMigration.includes('USING (false) WITH CHECK (false)')],
  ['realtime transport blocks client-asserted financial outcomes', realtime.includes('SERVER_AUTHORITATIVE_EVENT_TYPES.has(e.type)')],
  ['offline message queue retains permanent-failure handling', offlineMessages.includes('failedItems') && offlineMessages.includes('result?.permanent')],
  ['phase 6 test is registered', pkg.scripts?.['test:phase6-media-messaging-realtime'] === 'node scripts/test-phase6-media-messaging-realtime.mjs'],
  ['phase 6 test is included in full CI verification', pkg.scripts?.['ci:verify']?.includes('npm run test:phase6-media-messaging-realtime')],
]
let failed = 0
for (const [label, pass] of checks) {
  console.log(`${pass ? 'PASS' : 'FAIL'} ${label}`)
  if (!pass) failed++
}
console.log(`Phase 6 media/messaging/realtime checks: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
