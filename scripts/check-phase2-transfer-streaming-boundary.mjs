import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
const route = readFileSync('app/api/economy/transfers/route.ts', 'utf8')
const parser = readFileSync('lib/server/http/read-bounded-json.ts', 'utf8')
const checks = [
  ['transfer route uses shared bounded JSON parser', /readBoundedJson\(request,\s*MAX_TRANSFER_BODY_CHARS\)/.test(route)],
  ['transfer route no longer buffers via request.text', !/request\.text\(\)/.test(route)],
  ['oversized transfer body returns 413', /parsedBody\.error === "REQUEST_TOO_LARGE" \? 413 : 400/.test(route)],
  ['malformed JSON is reported with stable code', /parsedBody\.error === "INVALID_JSON" \? "INVALID_JSON"/.test(route)],
  ['parser validates declared content length', /content-length/.test(parser) && /parsedLength > maxBytes/.test(parser)],
  ['parser enforces actual streamed byte count', /totalBytes \+= value\.byteLength/.test(parser) && /totalBytes > maxBytes/.test(parser)],
  ['parser cancels oversized stream', /reader\.cancel\(/.test(parser)],
  ['parser rejects invalid UTF-8', /TextDecoder\("utf-8", \{ fatal: true \}\)/.test(parser)],
  ['authenticated sender identity remains authoritative', /senderId:\s*auth\.userId/.test(route)],
]
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  assert.ok(ok, name)
}
console.log(`PASS ${checks.length}/${checks.length} transfer streaming checks`)
