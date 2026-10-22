#!/usr/bin/env node
/**
 * Static GHC wallet / economy authorization scan.
 * Ensures financial routes bind actor from session and ignore client balance authority.
 */
import fs from 'fs'
import path from 'path'

const root = process.cwd()
const economyDir = path.join(root, 'app/api/economy')
const files = []
function walk(d) {
  if (!fs.existsSync(d)) return
  for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, ent.name)
    if (ent.isDirectory()) walk(p)
    else if (ent.name === 'route.ts') files.push(p)
  }
}
walk(economyDir)

let pass = 0
let fail = 0
const issues = []

for (const f of files) {
  const src = fs.readFileSync(f, 'utf8')
  const rel = path.relative(root, f)

  // Health and explicitly allow-listed read-only policy/proposal endpoints may be public.
  // Keep the allow-list narrow: a route must expose only server-owned non-account metadata.
  const publicPolicyRoutes = new Map([
    ['app/api/economy/policy/route.ts', /getPublicGhcEconomyPolicy/],
    ['app/api/economy/pi-acquisition-policy/route.ts', /getPiGhcAcquisitionProposal/],
    // Public pricing/catalog metadata and aggregate supply transparency are
    // intentionally read-only. Their tests below require server-owned providers
    // and reject mutating HTTP handlers or client-provided request bodies.
    ['app/api/economy/catalog/route.ts', /listPublicSpendCatalog/],
    ['app/api/economy/supply/route.ts', /rpcEconomicPopulationStats/],
  ])
  if (rel.includes('/health/')) {
    pass++
    continue
  }
  if (publicPolicyRoutes.has(rel)) {
    const expectedProvider = publicPolicyRoutes.get(rel)
    if (!expectedProvider.test(src) || /resolveAuthenticatedUser|request\.json\(|export async function POST|export async function PUT|export async function DELETE/.test(src)) {
      issues.push(`${rel}: public policy must be read-only and expose only its approved server-owned policy provider`)
      fail++
      continue
    }
    pass++
    continue
  }

  if (!/resolveAuthenticatedUser/.test(src)) {
    issues.push(`${rel}: missing resolveAuthenticatedUser`)
    fail++
    continue
  }

  // Dangerous: using body.userId as actor for money move
  if (/p_user_id:\s*body\.userId|userId:\s*body\.userId\s*,\s*$/m.test(src) &&
      /transfer|spend|claim|credit/.test(rel)) {
    // allow if void body.userId present
    if (!/void body\.userId/.test(src) && !/auth\.userId/.test(src)) {
      issues.push(`${rel}: may trust body.userId as actor`)
      fail++
      continue
    }
  }

  if (/senderId:\s*String\(body\.senderId/.test(src)) {
    issues.push(`${rel}: sender from body`)
    fail++
    continue
  }

  pass++
}

// Critical files must ignore client balance / amount claims
const critical = [
  'app/api/economy/transfers/route.ts',
  'app/api/economy/ledger/spend/route.ts',
  'app/api/economy/rewards/daily/route.ts',
  'app/api/economy/rewards/claim/route.ts',
]
for (const rel of critical) {
  const src = fs.readFileSync(path.join(root, rel), 'utf8')
  if (!/resolveAuthenticatedUser/.test(src)) {
    issues.push(`${rel}: missing auth`)
    fail++
  } else if (!/auth\.userId/.test(src)) {
    issues.push(`${rel}: missing auth.userId usage`)
    fail++
  } else {
    pass++
  }
}

// Wallet path must use requireSameUser
const wallet = fs.readFileSync(path.join(root, 'app/api/economy/wallet/[userId]/route.ts'), 'utf8')
if (!/requireSameUser/.test(wallet)) {
  issues.push('wallet/[userId]: missing requireSameUser')
  fail++
} else pass++

// Daily claim must ignore client amount
const daily = fs.readFileSync(path.join(root, 'app/api/economy/rewards/daily/route.ts'), 'utf8')
if (!/void body\.amount/.test(daily)) {
  issues.push('daily claim: does not void body.amount')
  fail++
} else pass++

console.log(`GHC wallet authz: ${pass} checks pass, ${fail} fail (${files.length} economy routes)`)
if (issues.length) {
  for (const i of issues) console.log(' FAIL', i)
  process.exit(1)
}
console.log('ALL GHC WALLET AUTHZ CHECKS PASSED')
