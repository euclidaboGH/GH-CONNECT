import fs from 'node:fs'

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const checks = [
  ['marketplace notification deep-link types', read('lib/notification-center.ts').includes('| "marketplace"') && read('lib/notification-center.ts').includes('surface === "marketplace"')],
  ['voice attachment is part of canonical Message type', read('lib/ghc-types.ts').includes('type: "image" | "gif" | "file" | "voice" | "video"')],
  ['message attachment includes duration metadata', read('lib/ghc-types.ts').includes('duration?: number // seconds for voice/video')],
  ['message attachment includes file size metadata', read('lib/ghc-types.ts').includes('size?: number // bytes')],
  ['conversation hydration preserves typed media attachments', read('contexts/ghc-context.tsx').includes('Message["mediaAttachments"]')],
  ['candidate name access is safe when candidate is absent', read('contexts/ghc-context.tsx').includes('Boolean(cand && cand.name)') && read('contexts/ghc-context.tsx').includes('String(cand?.name || "Match")')],
  ['group message renderer handles voice attachment', read('components/ghc/enhanced-group-message.tsx').includes('case "voice"')],
]
let failed = 0
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`)
  if (!ok) failed++
}
console.log(`Follow-up build regression checks: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
