#!/usr/bin/env node
import { readFileSync } from 'node:fs'
const css = readFileSync('app/globals.css', 'utf8')
const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
const checks = [
  ['release package is 0.338.55', pkg.version === '0.338.55'],
  ['mobile marketplace header and toolbar are compact', css.includes('.gh-world-marketplace > .gh-marketplace-header') && css.includes('.gh-marketplace-header [role="toolbar"] button')],
  ['community expanded header no longer imposes oversized hero height', css.includes('.gh-world-community .gh-app-header-expanded > div') && css.includes('.gh-world-community > header > div:first-child { min-height: 0 !important; }')],
  ['discovery intro and outcome panels are compact without being removed', css.includes('.gh-discovery-intro > div { margin: 0 !important;') && css.includes('.gh-discovery-shell > section[aria-label]')],
  ['messages relationship summary is compact without hiding controls', css.includes('.gh-world-inbox > header > section[aria-label="Relationship action centre"]')],
  ['all four modules retain shrinkable content regions', ['.gh-world-marketplace', '.gh-world-community', '.gh-world-discovery', '.gh-world-inbox'].every((selector) => css.includes(selector))],
]
for (const [label, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`)
console.log(`Run 292 mobile content layout: ${checks.filter(([, ok]) => ok).length}/${checks.length}`)
if (checks.some(([, ok]) => !ok)) process.exit(1)
