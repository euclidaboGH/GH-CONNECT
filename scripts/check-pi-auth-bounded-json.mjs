#!/usr/bin/env node
/** Regression guard: Pi auth must cap streamed JSON before buffering unbounded input. */
import fs from 'node:fs'
const auth = fs.readFileSync('app/api/auth/pi/route.ts', 'utf8')
const bounded = fs.readFileSync('lib/server/http/read-bounded-json.ts', 'utf8')
const checks = [
  ['Pi auth imports the shared bounded streaming parser', /import \{ readBoundedJson \} from "@\/lib\/server\/http\/read-bounded-json"/.test(auth)],
  ['Pi auth enforces the 16 KiB cap during body read', /readBoundedJson\(request, 16_384\)/.test(auth)],
  ['Pi auth maps oversized bodies to HTTP 413', /parsedBody\.error === "REQUEST_TOO_LARGE" \? 413 : 400/.test(auth)],
  ['Pi auth no longer calls request.text for unbounded buffering', !/request\.text\(\)/.test(auth)],
  ['shared parser rejects excessive declared content length before reading', /if \(parsedLength > maxBytes\)[\s\S]*?REQUEST_TOO_LARGE/.test(bounded)],
  ['shared parser cancels streamed bodies immediately after crossing limit', /totalBytes > maxBytes[\s\S]*?reader\.cancel\("request body exceeds configured limit"\)/.test(bounded)],
  ['shared parser rejects invalid UTF-8 and malformed JSON', /TextDecoder\("utf-8", \{ fatal: true \}\)/.test(bounded) && /JSON\.parse\(raw\)/.test(bounded)],
  ['shared parser rejects arrays and non-object payloads', /Array\.isArray\(value\)/.test(bounded) && /INVALID_BODY/.test(bounded)],
]
let failed = 0
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failed++ }
console.log(`\nPi auth bounded JSON checks: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
