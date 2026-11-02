#!/usr/bin/env node
/** Phase 7: media, stories and private-asset resilience contracts. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const upload = readFileSync('lib/media/upload-client.ts', 'utf8')
const signedUrl = readFileSync('app/api/media/[id]/signed-url/route.ts', 'utf8')
const checks = [
  ['media uploads reject empty or invalid-sized files before network calls', /Number\.isSafeInteger\(file\.size\) \|\| file\.size <= 0/.test(upload) && /EMPTY_FILE/.test(upload)],
  ['client filenames are reduced to safe leaf names and bounded length', /function safeUploadName/.test(upload) && /split\("\/"\)\.pop/.test(upload) && /slice\(0, 160\)/.test(upload)],
  ['API upload requests have a finite timeout', /API_REQUEST_TIMEOUT_MS = 30_000/.test(upload) && /async function fetchWithTimeout/.test(upload)],
  ['timeout abort signals are always cleaned up', /const timeout = setTimeout\([\s\S]*?finally \{\s*clearTimeout\(timeout\)/.test(upload)],
  ['Pi session recovery uses bounded network requests', /fetchWithTimeout\(input, init\)/.test(upload) && /fetchWithTimeout\("\/api\/auth\/pi"/.test(upload)],
  ['Pi-session recovery retry is also bounded by the request timeout', /return await fetchWithTimeout\(input, \{ \.\.\.init, credentials: "include" \}\)/.test(upload)],
  ['storage upload fallback only retries explicit unsupported-method responses', /putRes\.status === 405 \|\| putRes\.status === 501/.test(upload) && /Never replay after a timeout\/network failure/.test(upload)],
  ['timeouts remain distinguishable from ordinary network failures', /error\.name === "TimeoutError"/.test(upload) && /MEDIA_REQUEST_TIMEOUT/.test(upload)],
  ['large storage transfers use a separate longer timeout', /STORAGE_UPLOAD_TIMEOUT_MS = 90_000/.test(upload) && /fetchWithTimeout\(String\(intent\.uploadUrl\)[\s\S]*?STORAGE_UPLOAD_TIMEOUT_MS/.test(upload)],
  ['proxy uploads still require server-confirmed durable media response', /res\.ok && data\.ok === true && data\.url/.test(upload)],
  ['direct uploads still require finalization receipt before success', /completeRes\.ok && complete\.ok === true && complete\.url/.test(upload)],
  ['failed upload outcomes remain explicit and non-durable', /ok: false,\s*durable: false/.test(upload)],
  ['private media signed-url responses remain non-cacheable', /Cache-Control.*private, no-store/.test(signedUrl) && /Pragma: "no-cache"/.test(signedUrl)],
  ['private media requires an authenticated viewer and rate limit', /if \(!auth\)[\s\S]*?AUTH_REQUIRED/.test(signedUrl) && /checkRateLimit/.test(signedUrl)],
  ['signed URL issuance retains viewer-aware authorization and bounded upstream calls', /gh_media_authorize_viewer/.test(signedUrl) && /AbortSignal\.timeout\(8_000\)/.test(signedUrl)],
]
let failed = 0
for (const [label, pass] of checks) {
  console.log(`${pass ? 'PASS' : 'FAIL'} ${label}`)
  if (!pass) failed++
}
console.log(`\nPhase 7 media and private-asset resilience: ${checks.length - failed}/${checks.length} passed`)
assert.equal(failed, 0, 'Media/story resilience checks failed')
