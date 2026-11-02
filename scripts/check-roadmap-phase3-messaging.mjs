#!/usr/bin/env node
/** Regression guards for message draft preservation and safe reconciliation. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync('components/ghc/message-screen.tsx', 'utf8')
const onReconcile = source.slice(source.indexOf('const onReconcile ='), source.indexOf('window.addEventListener("ghc:navigate-tab"'))
const openThread = source.slice(source.indexOf('const openThread = useCallback'), source.indexOf('const closeThread = useCallback'))
const draftRestore = source.slice(source.indexOf('// Restore a conversation-specific draft'), source.indexOf('const requestCount = useMemo'))
const checks = [
  ['reconnect reconciliation does not clear composer draft', !/onReconcile[\s\S]*?setDraft\(""\)/.test(onReconcile)],
  ['reconnect reconciliation still resets message window', onReconcile.includes('setWindowSize(MESSAGE_WINDOW)')],
  ['opening another thread does not delete previous draft storage', !openThread.includes('localStorage.removeItem(`ghc.message-draft.${selectedId}`)')],
  ['drafts are restored per selected conversation', draftRestore.includes('localStorage.getItem(`ghc.message-draft.${selectedId}`)')],
  ['drafts are persisted per selected conversation', draftRestore.includes('localStorage.setItem(key, draft)')],
  ['blank drafts remove only their own conversation key', draftRestore.includes('localStorage.removeItem(key)')],
  ['storage failures remain non-fatal', draftRestore.includes('catch { /* storage is best-effort */ }')],
  ['send failures restore the unsent text', /if \(accepted === false \|\| accepted === undefined\)[\s\S]*?setDraft\(text\)/.test(source) && /catch \{[\s\S]*?setDraft\(text\)/.test(source)],
  ['message reconciliation continues without swallowing composer state', source.includes('ghc:messaging-reconcile') && onReconcile.includes('markedRef.current = null')],
]
for (const [label, pass] of checks) {
  console.log(`${pass ? 'PASS' : 'FAIL'} ${label}`)
  assert.ok(pass, label)
}
console.log(`PASS ${checks.length}/${checks.length} Phase 3 messaging regression checks`)
