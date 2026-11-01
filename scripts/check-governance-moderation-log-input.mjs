import fs from 'node:fs'

const routePath = 'app/api/governance/moderation-log/route.ts'
const source = fs.readFileSync(routePath, 'utf8')
const checks = [
  ['reads request through bounded JSON parser', /readBoundedJson\(req,\s*12\s*\*\s*1024\)/.test(source)],
  ['rejects missing, scalar, and array entry values', /!candidate\s*\|\|\s*typeof candidate !== "object"\s*\|\|\s*Array\.isArray\(candidate\)/.test(source)],
  ['narrows untrusted entry before property access', /candidate as Record<string, unknown>/.test(source)],
  ['validates and bounds communityId/action/id strings', /communityId\.length > 128/.test(source) && /action\.length > 80/.test(source) && /entryId\.length > 128/.test(source)],
  ['does not claim durable persistence without implementation', /durable:\s*false/.test(source)],
]
const failures = checks.filter(([, ok]) => !ok)
for (const [label, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`)
if (failures.length) process.exit(1)
console.log(`governance-moderation-log-input: ${checks.length}/${checks.length} passed`)
