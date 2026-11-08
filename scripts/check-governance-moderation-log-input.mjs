import fs from 'node:fs'

const routePath = 'app/api/governance/moderation-log/route.ts'
const source = fs.readFileSync(routePath, 'utf8')
const checks = [
  ['reads request through bounded JSON parser', /readBoundedJson\(req,\s*12\s*\*\s*1024\)/.test(source)],
  ['rejects missing, scalar, and array entry values', /!candidate\s*\|\|\s*typeof candidate !== "object"\s*\|\|\s*Array\.isArray\(candidate\)/.test(source)],
  ['narrows untrusted entry before property access', /candidate as Record<string, unknown>/.test(source)],
  ['validates action and target allowlists before writing', /ACTIONS\.has\(action\)/.test(source) && /TARGETS\.has\(targetType\)/.test(source)],
  ['derives actor identity from the authenticated server session', /actorId:\s*auth\.userId/.test(source) && !/actorId:\s*entry\./.test(source)],
  ['requires moderator authority and confirms durable server writes', /requireCommunityModerator/.test(source) && /durable:\s*true/.test(source)],
]
const failures = checks.filter(([, ok]) => !ok)
for (const [label, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`)
if (failures.length) process.exit(1)
console.log(`governance-moderation-log-input: ${checks.length}/${checks.length} passed`)
