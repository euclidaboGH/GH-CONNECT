import fs from 'node:fs'

const route = fs.readFileSync('app/api/economy/withdrawals/route.ts', 'utf8')
const parser = fs.readFileSync('lib/server/http/read-bounded-json.ts', 'utf8')
const checks = [
  ['withdrawal route uses shared bounded streaming parser', route.includes('readBoundedJson(request, 8 * 1024)')],
  ['withdrawal route does not use unbounded request.json()', !route.includes('request.json()')],
  ['oversized withdrawal request maps to HTTP 413', route.includes('parsedBody.error === "REQUEST_TOO_LARGE" ? 413 : 400')],
  ['malformed withdrawal body has stable error response', route.includes('Invalid withdrawal request body') && route.includes('parsedBody.error')],
  ['parser validates declared content length', parser.includes('content-length') && parser.includes('parsedLength > maxBytes')],
  ['parser enforces actual streamed byte count', parser.includes('totalBytes > maxBytes')],
  ['parser cancels oversized body stream', parser.includes('reader.cancel(')],
  ['parser rejects invalid UTF-8', parser.includes('fatal: true')],
  ['withdrawal responses are non-cacheable on parse errors', route.includes('"Cache-Control": "no-store"')],
]
for (const [label, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`)
console.log(`RESULT ${checks.filter(([, ok]) => ok).length}/${checks.length}`)
if (checks.some(([, ok]) => !ok)) process.exitCode = 1
