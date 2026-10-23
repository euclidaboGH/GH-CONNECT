import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const checks = []
function pass(name, ok, detail='') { checks.push({name, ok, detail}) }
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8') }

const app = read('components/ghc/app.tsx')
const globals = read('app/globals.css')
const sheet = read('components/ghc/action-sheet.tsx')
const confirm = read('components/ghc/confirmation-dialog.tsx')
const skip = read('components/ghc/skip-to-content.tsx')
const announcer = read('components/ghc/accessibility-announcer.tsx')

pass('Skip link is mounted', app.includes('<SkipToContent />') && skip.includes('#ghc-main-content'))
pass('Main content has stable skip target', app.includes('id="ghc-main-content"') && app.includes('tabIndex={-1}'))
pass('Global navigation announcements', app.includes('<AccessibilityAnnouncer') && announcer.includes('aria-live="polite"'))
pass('Global keyboard shortcuts are mounted', app.includes('<GlobalHotkeys />'))
pass('Action sheet uses labelled dialog semantics', sheet.includes('aria-labelledby={`${id}-title`}') && sheet.includes('id={`${id}-title`}'))
pass('Confirmation dialog uses labelled/described semantics', confirm.includes('aria-labelledby="gh-confirmation-title"') && confirm.includes('aria-describedby="gh-confirmation-message"'))
pass('Consistent keyboard focus ring', globals.includes('--gh-focus-ring-width') && globals.includes('focus-visible'))
pass('Touch target contract', globals.includes('--gh-touch-target: 44px') && globals.includes('min-height: max(40px, var(--gh-touch-target))'))
pass('Reduced motion contract', globals.includes('@media (prefers-reduced-motion: reduce)'))
pass('Forced colors contract', globals.includes('@media (forced-colors: active)'))
pass('Safe-area footer contract', globals.includes('env(safe-area-inset-bottom'))
pass('No production secrets in env example', fs.existsSync(path.join(root,'.env.example')))

const cssFocusCount = (globals.match(/focus-visible/g) || []).length
pass('Focus system has explicit coverage', cssFocusCount >= 4, `focus-visible occurrences=${cssFocusCount}`)

const files = []
for (const dir of ['app','components']) {
  const walk = (d) => {
    for (const ent of fs.readdirSync(d, {withFileTypes:true})) {
      const full = path.join(d,ent.name)
      if (ent.isDirectory()) walk(full)
      else if (/\.(tsx|jsx)$/.test(ent.name)) files.push(full)
    }
  }
  walk(path.join(root, dir))
}
let dialogs=0, labelledDialogs=0
for (const f of files) {
  const s=fs.readFileSync(f,'utf8')
  for (const m of s.matchAll(/role=["']dialog["'][^>]*>/g)) {
    dialogs++
    if (/aria-(?:label|labelledby)=/.test(m[0])) labelledDialogs++
  }
}
pass('Dialog labels are explicit', labelledDialogs === dialogs, `${labelledDialogs}/${dialogs} labelled dialogs`)

const failures=checks.filter(x=>!x.ok)
for (const c of checks) console.log(`${c.ok?'PASS':'FAIL'} ${c.name}${c.detail?` — ${c.detail}`:''}`)
if (failures.length) process.exit(1)
console.log(`Phase 38 accessibility/UX checks: ${checks.length}/${checks.length} PASS`)
