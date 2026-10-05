#!/usr/bin/env node
/**
 * Static two-user IDOR / actor-binding scanner for GH-CONNECT APIs.
 * Does not prove runtime behavior; fails on obvious client-as-actor patterns.
 */
import fs from 'fs'
import path from 'path'

const root = process.cwd()
const apiRoot = path.join(root, 'app/api')
const routes = []
function walk(d) {
  for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, ent.name)
    if (ent.isDirectory()) walk(p)
    else if (ent.name === 'route.ts') routes.push(p)
  }
}
walk(apiRoot)

const PUBLIC_ALLOW = [
  '/api/health',
  '/api/health/live',
  '/api/validation-key',
  '/api/economy/health',
  '/api/payments/health',
  '/api/auth/pi',
  '/api/auth/session',
  '/api/auth/logout',
  '/api/messaging/premium', // product info GET may be public
]

let pass = 0
let fail = 0
const issues = []

function rel(f) {
  return path.relative(root, f).replace(/\\/g, '/')
}

function isPublicish(r) {
  const s = '/' + rel(r).replace(/^app/, '').replace(/\\/g, '/')
  // normalize app/api/...
  const key = rel(r)
  return PUBLIC_ALLOW.some((a) => key.includes(a.replace(/^\//, '')) || key.includes('health/route'))
}

for (const f of routes) {
  const src = fs.readFileSync(f, 'utf8')
  const r = rel(f)

  // Dangerous: bind actor from body without void
  if (/p_user_id:\s*String\(\s*body\.userId/.test(src) || /p_user_id:\s*body\.userId/.test(src)) {
    if (!/void body\.userId/.test(src) && !/auth\.userId/.test(src)) {
      issues.push(`${r}: p_user_id may bind body.userId`)
      fail++
      continue
    }
  }
  if (/senderId:\s*String\(\s*body\.senderId/.test(src)) {
    issues.push(`${r}: senderId from body`)
    fail++
    continue
  }
  if (/createdBy:\s*String\(\s*body\.(createdBy|ownerId|userId)/.test(src)) {
    issues.push(`${r}: createdBy from client body`)
    fail++
    continue
  }

  // Mutations should auth (except known public)
  if (/(export async function POST|export async function PATCH|export async function DELETE)/.test(src)) {
    const publicMutation =
      r.includes('auth/pi') ||
      r.includes('auth/logout') ||
      r.includes('validation-key') ||
      r.includes('health/')
    if (!publicMutation && !/resolveAuthenticatedUser|authorize\(/.test(src)) {
      issues.push(`${r}: mutation without resolveAuthenticatedUser/authorize`)
      fail++
      continue
    }
  }
  pass++
}

// Critical anchors
const anchors = [
  ['app/api/economy/wallet/[userId]/route.ts', /requireSameUser/],
  ['app/api/economy/transfers/route.ts', /void body\.senderId/],
  ['app/api/economy/transfers/[referenceId]/route.ts', /parties\.includes\(auth\.userId\)/],
  ['app/api/economy/rewards/claim/route.ts', /auth\.userId/],
  ['app/api/economy/rewards/daily/route.ts', /void body\.amount/],
  ['app/api/payments/complete/route.ts', /intent\.userId !== auth\.userId/],
  ['app/api/payments/fulfill/route.ts', /intent\.userId !== auth\.userId/],
  ['app/api/messaging/conversations/[conversationId]/messages/route.ts', /senderId: auth\.userId/],
  ['app/api/communities/[id]/roles/route.ts', /INVALID_ROLE|ALLOWED/],
  ['app/api/media/route.ts', /auth\.userId/],
  ['app/api/profile/me/route.ts', /delete input\.userId|auth\.userId/],
  ['app/api/economy/notifications/[id]/read/route.ts', /markGhcNotificationRead\(auth\.userId/],
]

for (const [file, re] of anchors) {
  const full = path.join(root, file)
  if (!fs.existsSync(full)) {
    issues.push(`missing anchor file: ${file}`)
    fail++
    continue
  }
  const src = fs.readFileSync(full, 'utf8')
  if (!re.test(src)) {
    issues.push(`anchor failed: ${file} / ${re}`)
    fail++
  } else pass++
}

console.log(`IDOR static: ${pass} pass, ${fail} fail (${routes.length} routes scanned)`)
if (issues.length) {
  for (const i of issues) console.log(' FAIL', i)
  process.exit(1)
}
console.log('ALL IDOR STATIC CHECKS PASSED')
