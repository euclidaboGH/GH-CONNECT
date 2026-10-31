import fs from 'node:fs'

const context = fs.readFileSync('contexts/ghc-context.tsx', 'utf8')
const types = fs.readFileSync('lib/ghc-types.ts', 'utf8')
const checks = [
  ['durable message mapping declares mediaAttachments', /mediaAttachments\?: Message\["mediaAttachments"\]/.test(context)],
  ['hydration preserves canonical voice attachments', /\["image", "gif", "video", "file", "voice"\]/.test(context)],
  ['hydration preserves attachment duration and size', /duration: typeof a\.duration/.test(context) && /size: typeof a\.size/.test(context)],
  ['canonical Message type includes voice and media metadata', /type: "image" \| "gif" \| "file" \| "voice" \| "video"/.test(types) && /waveform\?: number\[\]/.test(types)],
  ['unsafe blob/data URLs are excluded from durable hydration', /!a\.url\.startsWith\("blob:"\) && !a\.url\.startsWith\("data:"\)/.test(context)],
]
let failed = 0
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`)
  if (!ok) failed++
}
console.log(`Message hydration media contract: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exitCode = 1
