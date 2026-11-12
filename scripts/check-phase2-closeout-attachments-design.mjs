import { readFileSync, existsSync, readdirSync } from 'node:fs'
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
let passed = 0, failed = 0
const check = (name, ok) => { if (ok) { passed++; console.log(`PASS ${name}`) } else { failed++; console.error(`FAIL ${name}`) } }

const policy = read('lib/server/media/message-attachment-policy.ts')
const validation = read('lib/server/media/owned-attachment-validation.ts')
const route = read('app/api/messaging/conversations/[conversationId]/messages/route.ts')
check('policy has server-side MIME allowlist', /MESSAGE_ATTACHMENT_MIME_KIND/.test(policy) && !/image\/svg/.test(policy) && !/text\/html/.test(policy))
check('policy enforces size via shared path-policy caps', /maxMediaBytesForMime/.test(policy))
check('policy checks ownership and ready state', /ATTACHMENT_NOT_OWNED/.test(policy) && /status !== "ready"/.test(policy))
check('policy sanitizes file names (bidi/control/path)', /sanitizeAttachmentFileName/.test(policy) && /202a-\\u202e/.test(policy))
check('validation re-reads stored asset record', /gh_media_assets\?id=eq\./.test(validation) && /reconcileAttachmentWithAsset/.test(validation))
check('validation still calls viewer-authorization RPC', /gh_media_authorize_viewer/.test(validation))
check('validation overrides client mime/type/size', /mimeType: server\.mimeType/.test(validation))
check('messages route uses validator and bounds attachments to 4', /validateOwnedMediaAttachments/.test(route) && /maxItems: 4/.test(route))
for (const [f, label] of [['components/ghc/discovery-grid-screen.tsx', 'Discover'], ['components/ghc/profile-screen.tsx', 'Profile'], ['components/ghc/rewards-centre-screen.tsx', 'Rewards']])
  check(`${label} title uses shared type token`, /<h1 className="gh-type-title/.test(read(f)))
check('scheduled publishing remains disabled (no scheduler)', /Scheduled publishing is not enabled/.test(read('components/ghc/creator-studio-panel.tsx')))
check('remote push remains disabled', /REMOTE_PUSH_NOT_ENABLED/.test(read('lib/notification-push-client.ts')))
const pkg = JSON.parse(read('package.json'))
check('package version is synchronized with the current release metadata', pkg.version === JSON.parse(read('package-lock.json')).version && read('lib/app-release.ts').includes(`APP_RELEASE_VERSION = \"${pkg.version}\"`))
console.log(`${passed}/${passed + failed} passed`)
process.exit(failed ? 1 : 0)
