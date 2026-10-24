import fs from 'node:fs'
import path from 'node:path'
const root = process.cwd()
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8')
const checks = [
  ['notification deep links include marketplace in open and tab', () => { const s=read('lib/notification-center.ts'); const t=s.slice(s.indexOf('export type NotificationDeepLink'), s.indexOf('section?:')); return (t.match(/"marketplace"/g)||[]).length >= 2 }],
  ['candidate match mapping uses declared Candidate fields', () => { const s=read('contexts/ghc-context.tsx'); const region=s.slice(s.indexOf('const candById'), s.indexOf('return {\n            ...s,\n            likes:')); return !region.includes('cand?.displayName') && !region.includes('cand.displayName') }],
  ['Message type declares optional media attachments', () => read('lib/ghc-types.ts').includes('mediaAttachments?: Array<{ id?: string; type: "image" | "video" | "file"; url: string; fileName?: string }>')],
  ['message hydration preserves optional media attachments', () => read('contexts/ghc-context.tsx').includes('mediaAttachments: (m as { mediaAttachments?: unknown }).mediaAttachments as any')],
]
let failed=0
for (const [label, test] of checks) { const ok=Boolean(test()); console.log(`${ok?'PASS':'FAIL'} ${label}`); if(!ok) failed++ }
console.log(`Follow-up Vercel error checks: ${checks.length-failed}/${checks.length} passed`)
if(failed) process.exit(1)
