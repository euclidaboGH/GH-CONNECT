#!/usr/bin/env node
/** Phase II #11 — shared design tokens and responsive app-shell contract. */
import fs from 'node:fs'
import assert from 'node:assert/strict'

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const css = read('app/globals.css')
const system = read('lib/design-system.ts')
const app = read('components/ghc/app.tsx')
const pkg = JSON.parse(read('package.json'))
const checks = [
  ['extended spacing scale is token-backed', ['--gh-space-6:', '--gh-space-7:', '--gh-space-8:'].every((token) => css.includes(token)) && system.includes('7: "var(--gh-space-7)"')],
  ['display, title, body and meta type tokens are defined', ['--gh-type-display:', '--gh-type-title:', '--gh-type-body:', '--gh-type-meta:'].every((token) => css.includes(token))],
  ['type tokens include shared line-height values', ['--gh-leading-display:', '--gh-leading-title:', '--gh-leading-body:', '--gh-leading-meta:'].every((token) => css.includes(token))],
  ['page gutter and content width are centralized', css.includes('--gh-page-gutter:') && css.includes('--gh-shell-content-max:') && css.includes('.gh-page-container {')],
  ['app shell remains fluid on phones', /\.gh-app-shell\s*\{[^}]*width:\s*100%/s.test(css)],
  ['ultra-wide app shell is bounded and centered', /@media\s*\(min-width:\s*1440px\)[\s\S]*?--gh-shell-max:\s*90rem/.test(css) && /\.gh-app-shell\s*\{[^}]*margin-inline:\s*auto/s.test(css)],
  ['desktop shell gains a restrained edge instead of stretching indefinitely', /@media\s*\(min-width:\s*1440px\)[\s\S]*?border-inline:[^;]+[\s\S]*?box-shadow:/s.test(css)],
  ['dialog and card dimensions use shared tokens', system.includes('var(--gh-card-padding)') && system.includes('var(--gh-dialog-max-width)')],
  ['focus visibility uses the semantic ring token', css.includes('--gh-focus-outline: 2px solid var(--ring)') && css.includes('outline: var(--gh-focus-outline)')],
  ['design-system colors no longer wrap complete values in hsl()', system.includes('primary: "var(--primary)"') && !system.includes('hsl(var(--primary))')],
  ['legacy spacing exports now reference runtime tokens', /export const spacing = \{[\s\S]*?1: "var\(--gh-space-1\)"[\s\S]*?8: "var\(--gh-space-8\)"/.test(system)],
  ['shell loading fallback uses the shared page container', app.includes('className="gh-page-container flex w-full flex-col gap-3"')],
  ['reduced-motion support remains in the shared stylesheet', css.includes('@media (prefers-reduced-motion: reduce)')],
  ['the adaptive shell pass is presentation-only', /without a\s+global restyle or changing any domain \/ financial behavior/.test(css)],
  ['new regression gate is registered before production build and in static verification', ['prebuild:checks', 'verify:static'].every((key) => pkg.scripts[key]?.includes('check-phase2-design-system-adaptive-shell.mjs'))],
]
let failures = 0
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`)
  if (!ok) failures++
}
console.log(`Phase II design-system/adaptive-shell contract: ${checks.length - failures}/${checks.length} passed`)
assert.equal(failures, 0, 'Phase II design-system/adaptive-shell contract failed')
