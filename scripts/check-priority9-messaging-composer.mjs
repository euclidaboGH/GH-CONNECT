#!/usr/bin/env node
/** Focused regression gate for responsive, keyboard-safe message composition. */
import fs from 'node:fs'
import assert from 'node:assert/strict'
const source = fs.readFileSync('components/ghc/message-components.tsx', 'utf8')
const checks = [
  ['composer owns a textarea ref for measured sizing', /composerRef = useRef<HTMLTextAreaElement>\(null\)/.test(source)],
  ['composer recalculates height when the draft changes', /useEffect\(\(\) => \{[\s\S]*?composer\.style\.height = "auto"[\s\S]*?\}, \[messageText\]\)/.test(source)],
  ['composer remains within the mobile-safe 120px growth cap', /Math\.min\(Math\.max\(composer\.scrollHeight, 44\), 120\)/.test(source)],
  ['long drafts scroll inside the composer instead of expanding indefinitely', /composer\.scrollHeight > 120 \? "auto" : "hidden"/.test(source)],
  ['Escape closes the emoji picker without submitting a message', /event\.key === "Escape" && showEmojiPicker/.test(source) && /setShowEmojiPicker\(false\)/.test(source)],
  ['composer preserves the existing 8000-character contract', /maxLength=\{8000\}/.test(source)],
  ['composer preserves Enter-to-send and Shift+Enter newline behavior', /e\.key === "Enter" && !e\.shiftKey && !e\.nativeEvent\.isComposing/.test(source)],
  ['composer preserves disabled and double-submit protections', /if \(disabled \|\| sendLockRef\.current\) return/.test(source) && /lastSentRef\.current\.text === trimmed/.test(source)],
]
for (const [label, pass] of checks) console.log(`${pass ? 'PASS' : 'FAIL'} ${label}`)
const failed = checks.filter(([, pass]) => !pass).length
console.log(`Responsive messaging composer: ${checks.length - failed}/${checks.length} passed`)
assert.equal(failed, 0, 'Responsive messaging composer regression gate failed')
