#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = process.cwd()
const apiRoot = join(root, 'app/api')
const ownerRegistry = JSON.parse(readFileSync(join(root, 'lib/architecture/domain-mutation-route-owners.json'), 'utf8'))
const rules = [...ownerRegistry.rules].sort((a, b) => b.prefix.length - a.prefix.length)
const domains = new Set(['identity','walletGhc','walletPiEarnings','marketplace','membership','messaging','feed','media','rewards','communities','notifications','trustSafety','payments','research','fieldOperations'])
const checks = []
const check = (label, ok, detail = '') => {
  checks.push(Boolean(ok))
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`)
}

function findTopLevelComma(source, start) {
  const stack = ['(']
  let state = 'code', quote = ''
  for (let i = start; i < source.length; i += 1) {
    const c = source[i], n = source[i + 1]
    if (state === 'line') { if (c === '\n') state = 'code'; continue }
    if (state === 'block') { if (c === '*' && n === '/') { state = 'code'; i += 1 } continue }
    if (state === 'string') { if (c === '\\') i += 1; else if (c === quote) state = 'code'; continue }
    if (state === 'template') { if (c === '\\') i += 1; else if (c === '`') state = 'code'; continue }
    if (c === '/' && n === '/') { state = 'line'; i += 1; continue }
    if (c === '/' && n === '*') { state = 'block'; i += 1; continue }
    if (c === '\'' || c === '"') { state = 'string'; quote = c; continue }
    if (c === '`') { state = 'template'; continue }
    if (c === '(' || c === '[' || c === '{') stack.push(c)
    else if (c === ')' || c === ']' || c === '}') {
      if (stack.length === 1) return -1
      stack.pop()
    } else if (c === ',' && stack.length === 1) return i
  }
  return -1
}
function findMatchingBrace(source, start) {
  let depth = 0, state = 'code', quote = ''
  for (let i = start; i < source.length; i += 1) {
    const c = source[i], n = source[i + 1]
    if (state === 'line') { if (c === '\n') state = 'code'; continue }
    if (state === 'block') { if (c === '*' && n === '/') { state = 'code'; i += 1 } continue }
    if (state === 'string') { if (c === '\\') i += 1; else if (c === quote) state = 'code'; continue }
    if (state === 'template') { if (c === '\\') i += 1; else if (c === '`') state = 'code'; continue }
    if (c === '/' && n === '/') { state = 'line'; i += 1; continue }
    if (c === '/' && n === '*') { state = 'block'; i += 1; continue }
    if (c === '\'' || c === '"') { state = 'string'; quote = c; continue }
    if (c === '`') { state = 'template'; continue }
    if (c === '{') depth += 1
    else if (c === '}' && --depth === 0) return i
  }
  return -1
}
function countBoundedFetchCalls(source) {
  let pos = 0, total = 0, bounded = 0, missing = []
  while (true) {
    const at = source.indexOf('fetch(', pos)
    if (at < 0) break
    const comma = findTopLevelComma(source, at + 6)
    if (comma < 0) { pos = at + 6; continue }
    let optionsStart = comma + 1
    while (/\s/.test(source[optionsStart] || '')) optionsStart += 1
    if (source[optionsStart] !== '{') { total += 1; missing.push(source.slice(at, at + 180).replace(/\s+/g, ' ')); pos = comma + 1; continue }
    const end = findMatchingBrace(source, optionsStart)
    if (end < 0) { total += 1; break }
    total += 1
    if (/\bsignal\s*:/.test(source.slice(optionsStart, end + 1))) bounded += 1; else missing.push(source.slice(at, end + 1).replace(/\s+/g, ' ').slice(0, 220))
    pos = end + 1
  }
  return { total, bounded, missing }
}

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const file = join(dir, name)
    if (statSync(file).isDirectory()) out.push(...walk(file))
    else if (name === 'route.ts') out.push(file)
  }
  return out
}
const files = walk(apiRoot)
let methodCount = 0
let mutating = 0
let owned = 0
let directFetchRoutes = 0
let timeoutCoveredFetchRoutes = 0
let directFetchCalls = 0
let boundedFetchCalls = 0
let mutatingWithRateLimit = 0
let mutatingWithDurableRateLimit = 0
let mutatingLocalOnly = 0
let mutatingWithoutRateLimit = 0
let unauthenticatedReview = 0
const unauthenticatedRoutes = []
const routeInventory = []
for (const file of files) {
  const source = readFileSync(file, 'utf8')
  const methods = [...source.matchAll(/export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)/g), ...source.matchAll(/export\s+const\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s*=/g), ...source.matchAll(/export\s*\{\s*(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s*\}/g)].map(m => m[1])
  methodCount += methods.length
  const writes = [...new Set(methods.filter(m => !['GET','HEAD','OPTIONS'].includes(m)))]
  const route = '/' + relative(join(root, 'app'), file).replaceAll('\\', '/').replace(/\/route\.ts$/, '')
  const directFetch = /\bfetch\s*\(/.test(source)
  const hasDeadline = /AbortSignal\.timeout\s*\(|timeoutMs\s*:|\bwithTimeout\s*\(|\bsupabaseRpc\s*\(|\bsupabaseRest\s*\(/.test(source)
  if (directFetch) directFetchRoutes++
  if (directFetch && hasDeadline) timeoutCoveredFetchRoutes++
  const fetchCoverage = countBoundedFetchCalls(source)
  directFetchCalls += fetchCoverage.total
  boundedFetchCalls += fetchCoverage.bounded
  if (fetchCoverage.missing.length) console.log(`FETCH DEADLINE REVIEW ${route}: ${fetchCoverage.missing.join(' | ')}`)
  const auth = /resolveAuthenticatedUser|requireAuthenticated|requireOperator|verifyOperator|requireAdmin|verifyWebhook|verifyPiWebhook|readSession|requireSession|auth\.user|assert.*Operator|authorized\(request\)|authorize\(req\)/i.test(source)
  if (!auth) { unauthenticatedReview++; unauthenticatedRoutes.push(route) }
  const durableRateLimited = /checkDurableRateLimit|enforceUserMutationRateLimit/i.test(source)
  const localRateLimited = /checkRateLimit\s*\(/i.test(source)
  const rateLimited = durableRateLimited || localRateLimited
  let owner = ''
  if (writes.length) {
    mutating++
    if (rateLimited) mutatingWithRateLimit++
    if (durableRateLimited) mutatingWithDurableRateLimit++
    else if (localRateLimited) mutatingLocalOnly++
    else mutatingWithoutRateLimit++
    const matches = rules.filter(rule => route === rule.prefix || route.startsWith(`${rule.prefix}/`))
    if (matches.length) {
      const longest = matches[0].prefix.length
      const selected = [...new Set(matches.filter(x => x.prefix.length === longest).map(x => x.owner))]
      if (selected.length === 1 && domains.has(selected[0])) { owner = selected[0]; owned++ }
    }
  }
  routeInventory.push({ route, methods: [...new Set(methods)].join(','), auth_marker: auth ? 'present' : 'review', rate_limit_marker: rateLimited ? 'present' : 'review', durable_rate_limit_marker: durableRateLimited ? 'present' : 'absent', deadline_marker: hasDeadline ? 'present' : (directFetch ? 'missing' : 'helper-or-none'), direct_fetch: directFetch ? 'yes' : 'no', mutation_owner: owner || (writes.length ? 'missing' : 'read-only') })
}
check('01 all API route files declare at least one HTTP method', files.every(file => /export\s+(?:(?:async\s+)?function\s+(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)|const\s+(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s*=|\{\s*(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s*\})/.test(readFileSync(file, 'utf8'))), `${files.length} route files`)
check('02 API route inventory matches the current expected baseline', files.length === 280, `${files.length} route files; ${methodCount} method exports`)
check('03 every mutating API route has one declared domain owner', owned === mutating, `${owned}/${mutating} owned`)
check('04 every route file with direct fetch has a timeout/helper marker', directFetchRoutes === timeoutCoveredFetchRoutes, `${timeoutCoveredFetchRoutes}/${directFetchRoutes} covered`)
check('05 every direct fetch call site has a literal AbortSignal deadline', directFetchCalls === 90 && boundedFetchCalls === directFetchCalls, `${boundedFetchCalls}/${directFetchCalls} direct fetch calls bounded`)
check('06 mutation rate limits distinguish durable controls from process-local telemetry and explicit exceptions', mutatingWithDurableRateLimit === 176 && mutatingLocalOnly === 2 && mutatingWithoutRateLimit === 8, `${mutatingWithDurableRateLimit}/${mutating} durable; ${mutatingLocalOnly} local-only telemetry; ${mutatingWithoutRateLimit} worker/disabled/cron/webhook/blocked/retired exceptions`)
check('07 timeout-hardening regression targets remain explicit', ['app/api/account/export/route.ts','app/api/connections/accept/route.ts','app/api/economy/purchase-ghc/route.ts','app/api/marketplace/payouts/route.ts','app/api/payments/complete/route.ts','app/api/social/tips/route.ts'].every(p => /AbortSignal\.timeout\(10_000\)/.test(readFileSync(join(root, p), 'utf8'))))
const phase4 = readFileSync(join(root, 'e2e/phase4-product-acceptance.spec.ts'), 'utf8')
check('08 Phase 4 acceptance suite covers all eleven requested product surfaces', ['Feed','Discover','Profiles','Messages','Communities','Marketplace','Wallet','Rewards','Membership','Notifications','Media'].every(label => phase4.includes(`\"${label}\"`)), 'authenticated Testnet acceptance suite')
check('09 Phase 4 suite requires real Testnet sessions and refuses Production', /GHC_E2E_PHASE4/.test(phase4) && /GHC_E2E_ALLOW_TESTNET/.test(phase4) && /isProdTarget/.test(phase4) && /GHC_E2E_COOKIE_A/.test(phase4) && /GHC_E2E_COOKIE_B/.test(phase4) && /PI_NETWORK !== \"testnet\"/.test(phase4) && /NEXT_PUBLIC_PI_SANDBOX !== \"true\"/.test(phase4))
const accessClassifications = JSON.parse(readFileSync(join(root, 'docs/RUN378-API-ACCESS-CLASSIFICATION-2026-11-19.json'), 'utf8'))
const classifiedRoutes = accessClassifications.map(item => item.route).sort()
check('10 every route without a generic session-auth marker has an explicit access classification and rationale', unauthenticatedRoutes.sort().join('\n') === classifiedRoutes.join('\n') && accessClassifications.every(item => item.class && item.reason && item.reason.length >= 20), `${unauthenticatedReview}/${accessClassifications.length} reviewed classifications`)
console.log(`\nRUN378 API route audit: ${checks.filter(Boolean).length}/${checks.length} checks passed; ${files.length} route files; ${mutating} mutating routes; ${directFetchRoutes} direct-fetch route files; ${boundedFetchCalls}/${directFetchCalls} direct calls bounded.`)
if (checks.some(ok => !ok)) process.exit(1)
