#!/usr/bin/env node
/** Independent UI/navigation regression gate for the 0.338.9 experience pass. */
import fs from 'node:fs'
import assert from 'node:assert/strict'

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const css = read('app/globals.css')
const header = read('components/ghc/collapsing-app-header.tsx')
const hotkeys = read('components/ghc/global-hotkeys.tsx')
const app = read('components/ghc/app.tsx')
const marketplace = read('components/ghc/marketplace-screen.tsx')
const communities = read('components/ghc/communities-screen.tsx')
const pkg = JSON.parse(read('package.json'))
const checks = [
  ['expanded app header uses compact 36px control rhythm', header.includes('min-h-9') && css.includes('.gh-app-header-expanded')],
  ['compact header is shorter and transition restrained', header.includes('gh-app-header-compact') && header.includes('duration-200')],
  ['inactive compact header is removed from keyboard navigation', /aria-hidden={!compact \|\| hidden}\s+inert={!compact \|\| hidden}/.test(header)],
  ['expanded header yields exclusively to compact header after threshold', /inert={compact}/.test(header) && /\$\{\s*compact\s*\?/.test(header)],
  ['compact header avoids duplicated subtitle content', /subtitle && !\(compactTitle \|\| title\)/.test(header)],
  ['header respects safe-area top inset', header.includes('env(safe-area-inset-top')],
  ['header retains reduced-motion support', css.includes('.gh-app-header { transition: none !important; }')],
  ['header focus targets retain accessible control dimensions', css.includes('.gh-app-header :where(button, a)')],
  ['marketplace header uses dedicated compact styling', marketplace.includes('gh-marketplace-header flex shrink-0 flex-col')],
  ['marketplace toolbar remains horizontally scrollable', /role="toolbar"[^>]*aria-label="Marketplace tools"/.test(marketplace) && marketplace.includes('overflow-x-auto')],
  ['marketplace listing content has increased responsive gutters', css.includes('.gh-marketplace-content {') && css.includes('padding-inline: clamp(0.875rem, 2.4vw, 1.75rem)')],
  ['marketplace content keeps bottom safe-area clearance', /\.gh-marketplace-content \{[\s\S]*?padding-bottom: max\(1\.75rem, env\(safe-area-inset-bottom/.test(css)],
  ['marketplace browse supports responsive listing columns', marketplace.includes('min-[640px]:grid-cols-3') && marketplace.includes('min-[960px]:grid-cols-4')],
  ['marketplace filter controls preserve currency-safe price contract', marketplace.includes('these currencies are never compared as one scale')],
  ['marketplace detail and browse headers share visual system', marketplace.includes('gh-marketplace-detail-header') && css.includes('.gh-marketplace-detail-header')],
  ['community directory has a bounded readable content column', communities.includes('max-w-2xl space-y-3 px-3 pb-8 pt-3 sm:px-5')],
  ['community scroll root remains touch-scrollable and stable', communities.includes('gh-scroll-stable min-h-0 flex-1 overflow-y-auto') && communities.includes('WebkitOverflowScrolling: "touch"')],
  ['community sections receive additional responsive breathing room', css.includes('.gh-world-community .gh-scroll-stable > * + *')],
  ['community surface continues to use shared collapsing header', communities.includes('<CollapsingAppHeader')],
  ['active tab scroll reset targets a stable panel identifier', app.includes('data-gh-tab-panel="${tab}"') && app.includes('scrollActiveTabToTop(activeTab)')],
  ['all six primary tab panels expose stable identifiers', ['home','discover','matches','communities','messages','profile'].every((tab) => app.includes(`data-gh-tab-panel="${tab}"`))],
  ['scroll reset resolves real scroll owners by computed overflow', app.includes('window.getComputedStyle(element)') && app.includes('element.scrollHeight > element.clientHeight + 2')],
  ['inactive tab panels remain inert', (app.match(/inert={activeTab !== "/g) || []).length >= 6],
  ['hotkeys ignore editable controls and disabled shortcut regions', hotkeys.includes('[data-shortcuts-disabled="true"]') && hotkeys.includes('[role="textbox"]')],
  ['hotkeys ignore modal workflows and IME composition', hotkeys.includes("target.closest('[role=\"dialog\"], [aria-modal=\"true\"]')") && hotkeys.includes('e.isComposing')],
  ['slash shortcut focuses search without forcing page scroll', hotkeys.includes('search.focus({ preventScroll: true })')],
  ['compose shortcut dispatches canonical app event', hotkeys.includes('ghc:open-compose')],
  ['hidden bottom navigation is inert and aria-hidden', /aria-hidden={bottomNavHidden \|\| showCreateHub}\s+inert={bottomNavHidden \|\| showCreateHub}/.test(app)],
  ['active bottom navigation destination remains announced', app.includes('aria-current={isActive ? "page" : undefined}')],
  ['bottom navigation controls preserve touch target and safe-area gutters', css.includes('.gh-bottom-nav button') && css.includes('safe-area-inset-left') && css.includes('safe-area-inset-right')],
  ['new independent UI audit is registered in build and static verification', ['prebuild:checks','verify:static'].every((key) => pkg.scripts[key]?.includes('check-ui-navigation-responsive-audit-20261109.mjs'))],
]
let failures = 0
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`)
  if (!ok) failures++
}
console.log(`Independent UI/navigation/responsive audit: ${checks.length - failures}/${checks.length} passed`)
assert.equal(failures, 0, 'Independent UI/navigation/responsive audit failed')
