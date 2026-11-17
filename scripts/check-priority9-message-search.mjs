#!/usr/bin/env node
/** Regression gate for membership-checked, indexed full-history message search. */
import fs from 'node:fs'
import assert from 'node:assert/strict'
const screen = fs.readFileSync('components/ghc/message-screen.tsx', 'utf8')
const parts = fs.readFileSync('components/ghc/message-components.tsx', 'utf8')
const checks = [
  ['thread header exposes an accessible search action', /aria-label="Search recent messages"/.test(parts) && /onSearch\?: \(\) => void/.test(parts)],
  ['search state is isolated to the active conversation UI', /messageSearchOpen/.test(screen) && /messageSearchQuery/.test(screen)],
  ['search uses the server-side full-history endpoint', /\/api\/messaging\/conversations\/\$\{encodeURIComponent\(selectedId\)\}\/search/.test(screen) && /Searches indexed message history on the server/.test(screen)],
  ['search query is bounded to 120 characters', /event\.target\.value\.slice\(0, 120\)/.test(screen) && /maxLength=\{120\}/.test(screen)],
  ['search input receives focus when the search panel opens', /messageSearchInputRef = useRef<HTMLInputElement>\(null\)/.test(screen) && /requestAnimationFrame\(\(\) => messageSearchInputRef\.current\?\.focus\(\)\)/.test(screen)],
  ['Escape closes search before it closes the conversation', /if \(messageSearchOpen\) \{[\s\S]*?setMessageSearchOpen\(false\)[\s\S]*?return[\s\S]*?closeThread\(\)/.test(screen)],
  ['search result count is announced accessibly', /aria-live="polite"[\s\S]{0,220}serverSearchTotal/.test(screen)],
  ['no-result state is distinct from an empty conversation', /No matching messages/.test(screen) && /Try another word or clear your search/.test(screen)],
  ['search closes and clears when the thread closes or changes', (screen.match(/setMessageSearchOpen\(false\)/g) || []).length >= 2 && (screen.match(/setMessageSearchQuery\(""\)/g) || []).length >= 3],
  ['filtered messages preserve the existing message bubble and action component', /visibleMessages\.map\(\(msg\) => \(/.test(screen) && /<MessageBubble/.test(screen)],
]
for (const [label, pass] of checks) console.log(`${pass ? 'PASS' : 'FAIL'} ${label}`)
const failed = checks.filter(([, pass]) => !pass).length
console.log(`In-thread message search: ${checks.length - failed}/${checks.length} passed`)
assert.equal(failed, 0, 'In-thread message search regression gate failed')
