#!/usr/bin/env node
/** Prevent false-positive message sends when durable storage is configured. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync('lib/server/messaging/message-store.ts', 'utf8')
const append = source.slice(source.indexOf('export async function appendMessage('), source.indexOf('export async function softDeleteMessage('))
const checks = [
  ['database insert failure is not acknowledged as a local success', /if \(!ins\.ok\)[\s\S]*?if \(clientMessageId\)[\s\S]*?return \{ ok: false, error: "PERSIST_FAILED" \}/.test(append)],
  ['insert must return a persisted representation with an ID', /if \(!Array\.isArray\(ins\.data\) \|\| !ins\.data\[0\] \|\| !String\(ins\.data\[0\]\.id \|\| ""\)\.trim\(\)\)[\s\S]*?return \{ ok: false, error: "PERSIST_FAILED" \}/.test(append)],
  ['local-only fallback is used only when no database is configured', /\} else if \(isProd\(\)\) \{\s*return \{ ok: false, error: "STORE_UNAVAILABLE" \}\s*\}/.test(append)],
  ['successful response is built from the persisted row', /Object\.assign\(msg, rowToMessage\(ins\.data\[0\]\)\)/.test(append)],
  ['idempotent database retry is checked before returning persistence failure', /if \(!ins\.ok\)[\s\S]*?const existing = await rest[\s\S]*?idempotent: true[\s\S]*?return \{ ok: false, error: "PERSIST_FAILED" \}/.test(append)],
]
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`)
  assert.ok(ok, label)
}
console.log(`PASS ${checks.length}/${checks.length} messaging durable-write checks`)
