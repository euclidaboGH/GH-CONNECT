import fs from 'node:fs'
import assert from 'node:assert/strict'

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
const resolver = read('lib/media/resolve-display-url.ts')
const identity = read('contexts/identity-context.tsx')
const image = read('components/ghc/lazy-image.tsx')
const video = read('components/ghc/durable-video.tsx')
const controls = read('components/ghc/account-data-controls.tsx')
const settings = read('components/ghc/settings.tsx')
const exportRoute = read('app/api/account/export/route.ts')
const lifecycleRoute = read('app/api/account/lifecycle/route.ts')
const durableImage = read('components/ghc/durable-image.tsx')
const durableVideo = read('components/ghc/durable-video.tsx')
const lightbox = read('components/ghc/media-lightbox.tsx')
const story = read('components/ghc/profile-story-section.tsx')
const shortVideo = read('components/ghc/short-video-screen.tsx')
const imageSurfaces = ['unified-compose','feed-components','short-video-screen','connection-request-inbox','composer-prompt-bar','engagement-roster-sheet','compose-media-strip','share-sheet','enhanced-post-card','comment-sheet','profile-content-library','create-group-modal','discovery-sections','enhanced-group-message','marketplace-screen','send-ghc-flow','community-people-you-may-know','home-command-centre','community-invite-card','discovery-components','feed-enhancements','onboarding','profile-story-section','media-with-retry']

const checks = [
  ['signed media cache is scoped to active identity epoch', /activeViewerScope/.test(resolver) && /requestEpoch/.test(resolver) && /cacheKey = `\$\{requestEpoch\}:\$\{mediaId\}`/.test(resolver)],
  ['identity changes invalidate media cache', /setDisplayMediaViewer\(identity\.userId, identity\.authState\)/.test(identity)],
  ['media session change refreshes image surfaces', /ghc:media-session-change/.test(image) && /setRetryToken/.test(image)],
  ['media session change clears video playback source', /ghc:media-session-change/.test(video) && /setPlaySrc\(null\)/.test(video)],
  ['account export is an owner-facing downloadable workflow', /\/api\/account\/export/.test(controls) && /URL\.createObjectURL/.test(controls) && /greenhaven-account-export-/.test(controls)],
  ['deletion request requires explicit confirmation phrase', /confirmDialog/.test(controls) && /promptDialog/.test(controls) && /phrase !== "DELETE"/.test(controls)],
  ['deletion UI does not claim immediate erasure', /does not immediately erase/.test(controls) && /remains active until the review/.test(controls)],
  ['account controls are integrated into privacy settings', /<AccountDataControls\s*\/>/.test(settings)],
  ['export endpoint requires recent server-side step-up', /requireRecentStepUp\(auth\)/.test(exportRoute)],
  ['export endpoint fails closed on incomplete source reads', /EXPORT_INCOMPLETE/.test(exportRoute) && /SOURCE_ROW_LIMIT_EXCEEDED/.test(exportRoute)],
  ['deletion intake requires recent step-up and idempotency', /requireRecentStepUp\(auth\)/.test(lifecycleRoute) && /IDEMPOTENCY_KEY_REQUIRED/.test(lifecycleRoute)],
  ['deletion endpoint explicitly does not execute destructive deletion', /deletionExecuted: false/.test(lifecycleRoute)],
  ['shared image primitive resolves private facade URLs and reacts to session changes', /resolveDisplayMediaUrl/.test(durableImage) && /ghc:media-session-change/.test(durableImage)],
  ['shared video primitive preserves native media events and forwards ref', /VideoHTMLAttributes/.test(durableVideo) && /forwardRef/.test(durableVideo) && /ghc:media-session-change/.test(durableVideo)],
  ['story viewer uses canonical private facade URLs for both media types', /DurableVideo key=\{viewing\.id\} src=\{viewing\.media\.url\}/.test(story) && /DurableImage src=\{viewing\.media\.url\}/.test(story)],
  ['short-video player retains video ref and lifecycle events through shared resolver', /DurableVideo/.test(shortVideo) && /ref=\{videoRef\}/.test(shortVideo) && /onTimeUpdate/.test(shortVideo)],
  ['full-screen lightbox re-resolves after account changes', /ghc:media-session-change/.test(lightbox) && /viewerEpoch/.test(lightbox) && /current\?\.url, viewerEpoch/.test(lightbox)],
  ['high-value dynamic image surfaces use the shared private-media component', imageSurfaces.every((name) => /<DurableImage/.test(read(`components/ghc/${name}.tsx`)))],
]

for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`)
}
assert.equal(checks.every(([, ok]) => ok), true, 'Phase 18 account privacy/media contract failed')
console.log(`Phase 18 account privacy and private-media checks: ${checks.length}/${checks.length} passed`)
