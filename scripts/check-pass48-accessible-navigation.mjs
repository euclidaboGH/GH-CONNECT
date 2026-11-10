import fs from 'node:fs'
import assert from 'node:assert/strict'

const app = fs.readFileSync(new URL('../components/ghc/app.tsx', import.meta.url), 'utf8')
const tabs = ['home', 'discover', 'matches', 'communities', 'messages', 'profile']
for (const tab of tabs) {
  const panel = app.match(new RegExp(`<div data-gh-tab-panel="${tab}" aria-hidden={activeTab !== "${tab}"} inert={activeTab !== "${tab}"} className="gh-tab-panel`))?.[0] ?? ''
  assert.ok(panel, `the ${tab} panel is hidden from assistive technology and keyboard interaction when inactive`)
}
const navStart = app.indexOf('<nav', app.indexOf('Bottom navigation'))
const navEnd = app.indexOf('>', navStart)
const nav = app.slice(navStart, navEnd + 1)
assert.match(nav, /aria-hidden={bottomNavHidden \|\| showCreateHub}/, 'hidden navigation is announced as hidden')
assert.match(nav, /inert={bottomNavHidden \|\| showCreateHub}/, 'hidden navigation cannot retain keyboard focus')
assert.match(app, /aria-current={isActive \? "page" : undefined}/, 'current navigation destination remains programmatically identified')
console.log('Pass 48 accessible navigation checks: PASS (six inactive panels and hidden navigation are inert)')
