import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const visibility = readFileSync('lib/server/social/post-visibility.ts', 'utf8')
const signedUrl = readFileSync('app/api/media/[id]/signed-url/route.ts', 'utf8')

assert.match(visibility, /type PostRow\s*=\s*\{[^}]*archived_at:\s*string\s*\|\s*null/s,
  'PostRow must model archived_at because canonical visibility queries select it')
assert.match(visibility, /select:\s*"id,author_id,visibility,community_id,deleted_at,archived_at"/,
  'canonical post visibility must continue selecting archived_at')
assert.match(signedUrl, /typeof storagePath !== "string"/,
  'signed URL route must runtime-validate storagePath after RPC/fallback assignment')
assert.match(signedUrl, /typeof ownerId !== "string"/,
  'signed URL route must runtime-validate ownerId')
assert.match(signedUrl, /typeof bucketName !== "string"/,
  'signed URL route must runtime-validate bucket')
assert.match(signedUrl, /storagePath\.startsWith\(`\$\{ownerId\}\/`\)/,
  'signed URL route must bind storage object path to the validated owner')
assert.match(signedUrl, /storagePath\.split\("\/"\)\.some\(\(part\) => !part \|\| part === "\."\)/,
  'signed URL route must reject empty and dot path segments')
assert.match(signedUrl, /storagePath\.split\("\/"\)\.map\(\(part\) => encodeURIComponent\(part\)\)/,
  'signed URL route must encode each validated path segment')

console.log('Latest CI regression checks: 8/8 passed')
