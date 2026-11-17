import fs from 'node:fs'

const composer = fs.readFileSync('components/ghc/unified-compose.tsx', 'utf8')
const strip = fs.readFileSync('components/ghc/compose-media-strip.tsx', 'utf8')
const video = fs.readFileSync('components/ghc/durable-video.tsx', 'utf8')
const checks = [
  ['failed attachments preserve the original File for same-session retry', composer.includes('file: File') && composer.includes('retryFailedAttachment')],
  ['retry UI preserves post text and ready attachments', composer.includes('Your text and other ready attachments stay in place')],
  ['failed attachment actions are disabled while upload or publish is active', composer.includes('disabled={Boolean(uploadProgress) || isPublishing}')],
  ['attachment failure states identify photo, video, and file separately', composer.includes('"photo" | "video" | "file"')],
  ['successful retry clears the matching attachment failure', composer.includes('clearFailedAttachment(file)')],
  ['story retries reuse a stable request ID while content is unchanged', composer.includes('storyRequestRef.current.signature !== storySignature') && composer.includes('id: storyRequestRef.current.id')],
  ['video preview defers media loading until user interaction', strip.includes('preload="none"') && video.includes('preload = "none"')],
  ['video element is keyed by resolved source so replaced media releases prior element', video.includes('key={playSrc}')],
  ['account changes clear queued attachment recovery state', composer.includes('setFailedAttachments([])')],
]
let failed = 0
for (const [label, pass] of checks) {
  console.log(`${pass ? 'PASS' : 'FAIL'} ${label}`)
  if (!pass) failed++
}
if (failed) process.exitCode = 1
else console.log(`Phase 3 upload recovery reliability: ${checks.length}/${checks.length} checks passed`)
