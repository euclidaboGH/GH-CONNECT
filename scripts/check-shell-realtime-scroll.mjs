#!/usr/bin/env node
import { readFileSync } from 'node:fs'
const app = readFileSync('components/ghc/app.tsx','utf8')
const hook = readFileSync('lib/use-scroll-header.ts','utf8')
const header = readFileSync('components/ghc/collapsing-app-header.tsx','utf8')
const css = readFileSync('app/globals.css','utf8')
const feed = readFileSync('components/ghc/enhanced-feed-screen.tsx','utf8')
const checks = [
 ['realtime transport boots once at app shell', /bootstrapRealtimeTransport\(\)/.test(app)],
 ['realtime recovery runs at bootstrap and reconnect', /recoverRealtimeEvents\(\)/.test(app) && /ghc:realtime-reconcile/.test(app)],
 ['remote domain events invalidate canonical sections', /event\.origin !== "remote"/.test(app) && /emitSectionRefresh\(section/.test(app)],
 ['scroll header work is animation-frame bounded', /requestAnimationFrame/.test(hook)],
 ['content-only immersion hides compact header while scrolling down', /compact && !hidden/.test(header)],
 ['scroll surfaces retain native touch momentum', /-webkit-overflow-scrolling: touch/.test(css) && /touch-action: pan-y pinch-zoom/.test(css)],
 ['scroll anchoring is enabled on primary roots', /overflow-anchor: auto/.test(css)],
 ['feed filters use editorial tab treatment', /border-b-2/.test(feed) && /border-\[var\(--gh-green\)\]/.test(feed)],
]
let passed=0
for (const [label,ok] of checks){ console.log(`${ok?'PASS':'FAIL'} ${label}`); if(ok) passed++ }
console.log(`\nShell/realtime/scroll: ${passed}/${checks.length} passed`)
if(passed!==checks.length) process.exit(1)
