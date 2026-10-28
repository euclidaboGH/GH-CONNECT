#!/usr/bin/env node
/** Regression guards for media diagnostics and bounded direct-upload APIs. */
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { maxMediaBytesForMime, validateMediaMetadata } from '../lib/server/media/path-policy.mjs'
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (path) => readFileSync(join(root, path), 'utf8')
const health = read('app/api/media/health/route.ts')
const intent = read('app/api/media/direct-upload-intent/route.ts')
const complete = read('app/api/media/direct-upload-complete/route.ts')
const content = read('app/api/media/[id]/content/route.ts')
const multipart = read('app/api/media/route.ts')
const boundedJson = read('lib/server/http/read-bounded-json.ts')
const checks = [
  ['media content facade never derives credentialed fetch target from request origin', !content.includes('const origin = new URL(request.url).origin') && content.includes('NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL') && content.includes('fetch(`${appOrigin}/api/media/')],
  ['media content facade fails closed without a trusted app origin in production', content.includes('process.env.NODE_ENV !== "production" ? "http://localhost:3000"') && content.includes('APP_ORIGIN_NOT_CONFIGURED')],
  ['media health rejects anonymous callers', health.indexOf('if (!auth)') > -1 && health.indexOf('if (!auth)') < health.indexOf('readGhcServerEnv()')],
  ['media health does not provision buckets', !health.includes('ensureMediaBucket') && health.includes('bucketProvisioning: "read-only"')],
  ['media health upstream request has a timeout', health.includes('signal: AbortSignal.timeout(8_000)')],
  ['multipart upload authenticates before body parsing', multipart.indexOf('resolveAuthenticatedUser') < multipart.indexOf('form = await request.formData()')],
  ['multipart upload rejects missing content length before buffering', multipart.indexOf('CONTENT_LENGTH_REQUIRED') < multipart.indexOf('form = await request.formData()')],
  ['multipart upload rejects malformed content length before buffering', multipart.indexOf('INVALID_CONTENT_LENGTH') < multipart.indexOf('form = await request.formData()')],
  ['multipart upload enforces a safe maximum request length before buffering', multipart.includes('Number.isSafeInteger(contentLength)') && multipart.includes('MAX_MEDIA_BYTES + 2 * 1024 * 1024') && multipart.indexOf('REQUEST_TOO_LARGE') < multipart.indexOf('form = await request.formData()')],
  ['multipart upload validates file size and metadata before bucket provisioning', multipart.indexOf('parseBoundedInteger(form.get("durationMs")') < multipart.indexOf('ensureMediaBucket(storageBucket)') && multipart.indexOf('file.size > maxBytes') < multipart.indexOf('ensureMediaBucket(storageBucket)')],
  ['media upload intent authenticates before bounded streaming JSON parse', intent.indexOf('resolveAuthenticatedUser') < intent.indexOf('readBoundedJson(request, maxBodyBytes)')],
  ['media upload intent uses shared hard streaming byte limit', intent.includes('readBoundedJson(request, maxBodyBytes)') && !intent.includes('request.text()')],
  ['media upload intent maps oversized payloads to 413', intent.includes('REQUEST_TOO_LARGE') && intent.includes('status = parsed.error')],
  ['media upload intent validates before storage provisioning', intent.indexOf('readBoundedJson(request, maxBodyBytes)') < intent.indexOf('ensureMediaBucket(storageBucket)')],
  ['media upload completion authenticates before bounded streaming JSON parse', complete.indexOf('resolveAuthenticatedUser') < complete.indexOf('readBoundedJson(request, maxBodyBytes)')],
  ['media upload completion uses shared hard streaming byte limit', complete.includes('readBoundedJson(request, maxBodyBytes)') && !complete.includes('request.text()')],
  ['media upload completion maps oversized payloads to 413', complete.includes('REQUEST_TOO_LARGE') && complete.includes('status = parsed.error')],
  ['shared bounded parser rejects malformed JSON and non-object payloads', boundedJson.includes('JSON.parse(raw)') && boundedJson.includes('Array.isArray(value)') && boundedJson.includes('INVALID_JSON')],
  ['shared bounded parser cancels oversized streams early', boundedJson.includes('reader.cancel("request body exceeds configured limit")')],
  ['media upload completion verifies upload session owner and path', complete.includes('gh_media_upload_session_get') && complete.includes('UPLOAD_SESSION_MISMATCH')],
  ['media upload completion verifies stored object metadata', complete.includes('UPLOADED_OBJECT_METADATA_MISMATCH') && complete.includes('storedSize !== byteSize')],
  ['all upload paths use the centralized MIME size policy', intent.includes('maxMediaBytesForMime(mime)') && complete.includes('maxMediaBytesForMime(mime)') && read('app/api/media/route.ts').includes('maxMediaBytesForMime(mime)')],
  ['image upload limit remains consistent at 50 MiB', maxMediaBytesForMime('image/jpeg') === 50 * 1024 * 1024],
  ['video upload limit remains consistent at 40 MiB', maxMediaBytesForMime('video/mp4') === 40 * 1024 * 1024],
  ['audio and PDF upload limits remain consistent at 50 MiB', maxMediaBytesForMime('audio/mpeg') === 50 * 1024 * 1024 && maxMediaBytesForMime('application/pdf') === 50 * 1024 * 1024],
  ['unsupported MIME types have no upload allowance', maxMediaBytesForMime('application/x-executable') === 0],
  ['metadata validation applies the per-type size limit', validateMediaMetadata({mediaKind:'video', mimeType:'video/mp4', byteSize:40 * 1024 * 1024 + 1}) === 'INVALID_BYTE_SIZE' && validateMediaMetadata({mediaKind:'image', mimeType:'image/jpeg', byteSize:50 * 1024 * 1024}) === null],
]
let failed = 0
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  if (!ok) failed++
}
console.log(`\nMedia API hardening checks: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
