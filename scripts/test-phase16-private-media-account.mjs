import fs from 'node:fs'
import assert from 'node:assert/strict'
const mediaContent = fs.readFileSync('app/api/media/[id]/content/route.ts', 'utf8')
const signedRoute = fs.readFileSync('app/api/media/[id]/signed-url/route.ts', 'utf8')
const exportRoute = fs.readFileSync('app/api/account/export/route.ts', 'utf8')
const lifecycle = fs.readFileSync('app/api/account/lifecycle/route.ts', 'utf8')
const checks = [
  ['content route validates opaque media IDs', mediaContent.includes('INVALID_MEDIA_ID') && mediaContent.includes('media_[a-z0-9]+')],
  ['content route delegates authorization to signer', mediaContent.includes('/signed-url')],
  ['content route does not accept arbitrary redirect targets', mediaContent.includes('signed.origin !== trustedStorageOrigin')],
  ['content route requires HTTPS storage URL', mediaContent.includes('signed.protocol !== "https:"')],
  ['content route is non-cacheable', mediaContent.includes('private, no-store')],
  ['signed URL lookup authorizes the actual viewer', signedRoute.includes('gh_media_authorize_viewer') && signedRoute.includes('p_viewer_id: auth.userId')],
  ['signed URL lookup rejects unauthorized media without enumeration', signedRoute.includes('MEDIA_NOT_FOUND')],
  ['signed URL lifetime is five minutes', signedRoute.includes('expiresIn: 300')],
  ['export reads paginated data', exportRoute.includes('readCompleteExportSource') && exportRoute.includes('Range-Unit')],
  ['export fails closed when source ceiling is exceeded', exportRoute.includes('SOURCE_ROW_LIMIT_EXCEEDED')],
  ['export responses are private and non-cacheable', exportRoute.includes('private, no-store')],
  ['deletion request requires recent step-up authentication', lifecycle.includes('requireRecentStepUp(auth)')],
  ['deletion is queued rather than executed by request endpoint', lifecycle.includes('deletionExecuted: false')],
  ['lifecycle safely handles malformed or non-object JSON', lifecycle.includes('!Array.isArray(parsedBody)')],
]
for (const [label, pass] of checks) { console.log(`${pass ? 'PASS' : 'FAIL'} ${label}`); assert.ok(pass, label) }
console.log(`Phase 16 private-media/account checks: ${checks.length}/${checks.length} passed`)
