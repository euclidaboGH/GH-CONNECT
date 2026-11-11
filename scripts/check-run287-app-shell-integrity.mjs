#!/usr/bin/env node
import { readFileSync } from 'node:fs'

const appPath = 'components/ghc/app.tsx'
const dashboardPath = 'components/ghc/unified-earnings-dashboard.tsx'
const app = readFileSync(appPath, 'utf8')
const dashboard = readFileSync(dashboardPath, 'utf8')
const appFunctions = [...app.matchAll(/^export function GHConnectApp\s*\(/gm)]
const lazyNames = [...app.matchAll(/^const\s+([A-Za-z_$][\w$]*)\s*=\s*lazy\(/gm)].map((m) => m[1])
const firstAppPos = appFunctions[0]?.index ?? -1
const declarationPos = (name) => {
  const match = new RegExp(`^const\\s+${name}\\s*=`, 'm').exec(app)
  return match?.index ?? -1
}
const checks = [
  ['single client directive', (app.match(/^\s*["']use client["'];?\s*$/gm) || []).length === 1],
  ['client directive is first statement', /^\s*["']use client["'];?/.test(app)],
  ['single exported GHConnectApp component', appFunctions.length === 1],
  ['all import declarations are module-level', /^import\s/m.test(app) && !/^import\s/m.test(app.slice(firstAppPos))],
  ['no second module header inside app body', !/^\s*["']use client["'];?\s*$/m.test(app.slice(firstAppPos + 1))],
  ['no import declarations after component begins', !/^import\s/m.test(app.slice(firstAppPos))],
  ['Onboarding lazy screen declared before component', declarationPos('Onboarding') >= 0 && declarationPos('Onboarding') < firstAppPos],
  ['PremiumWalletScreen lazy screen declared before component', declarationPos('PremiumWalletScreen') >= 0 && declarationPos('PremiumWalletScreen') < firstAppPos],
  ['SettingsScreen lazy screen declared before component', declarationPos('SettingsScreen') >= 0 && declarationPos('SettingsScreen') < firstAppPos],
  ['MarketplaceScreenLazy declared before component', declarationPos('MarketplaceScreenLazy') >= 0 && declarationPos('MarketplaceScreenLazy') < firstAppPos],
  ['GreenHavenEcosystemLazy declared before component', declarationPos('GreenHavenEcosystemLazy') >= 0 && declarationPos('GreenHavenEcosystemLazy') < firstAppPos],
  ['lazy screen declarations have unique identifiers', new Set(lazyNames).size === lazyNames.length],
  ['app shell uses Suspense boundaries', /<Suspense\b/.test(app)],
  ['app shell uses screen-level error boundaries', /<ScreenBoundary\b/.test(app)],
  ['app shell retains skip-to-content accessibility', /<SkipToContent\b/.test(app)],
  ['app shell retains accessible status announcements', /<AccessibilityAnnouncer\b/.test(app)],
  ['app shell retains transient overlay cleanup', /closeAllActionSheets|dispatchCloseTransientUI/.test(app)],
  ['app shell retains realtime recovery wiring', /bootstrapRealtimeTransport/.test(app) && /recoverRealtimeEvents/.test(app)],
  ['app shell TSX has no parser diagnostics', !/^\s*import\s/m.test(app.slice(firstAppPos)) && (app.match(/<\/?[A-Za-z][^>]*>/g) || []).length > 0],
  ['earnings dashboard TSX has no parser diagnostics', (dashboard.match(/<\/?[A-Za-z][^>]*>/g) || []).length > 0 && !/\{\s*\n\s*<\//.test(dashboard)],
]
let failed = 0
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  if (!ok) failed++
}
console.log(`Run #287 app-shell integrity: ${checks.length - failed}/${checks.length}`)
if (failed) process.exitCode = 1
