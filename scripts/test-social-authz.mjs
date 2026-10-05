#!/usr/bin/env node
/**
 * Static social authorization scan — ensures social routes bind actor from session.
 */
import fs from 'fs'
import path from 'path'

const root = process.cwd()
const socialDir = path.join(root, 'app/api/social')
let files = []
function walk(d) {
  for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, ent.name)
    if (ent.isDirectory()) walk(p)
    else if (ent.name === 'route.ts') files.push(p)
  }
}
walk(socialDir)

let pass = 0
let fail = 0
const issues = []

for (const f of files) {
  const src = fs.readFileSync(f, 'utf8')
  const rel = path.relative(root, f)
  const hasAuth = /resolveAuthenticatedUser/.test(src)
  const isGetOnlyReadme = false
  if (!hasAuth) {
    issues.push(`${rel}: missing resolveAuthenticatedUser`)
    fail++
    continue
  }
  // Dangerous patterns: trusting body.authorId as ownership without auth.userId
  if (/authorId:\s*body\.authorId/.test(src) || /authorId:\s*String\(body\.authorId/.test(src)) {
    issues.push(`${rel}: trusts body.authorId as author`)
    fail++
    continue
  }
  if (/p_user_id:\s*body\./.test(src) || /p_actor_id:\s*body\./.test(src)) {
    issues.push(`${rel}: passes body identity into RPC actor`)
    fail++
    continue
  }
  pass++
}

console.log(`Social authz static scan: ${pass} pass, ${fail} fail, ${files.length} routes`)
if (issues.length) {
  for (const i of issues) console.log('  FAIL', i)
  process.exit(1)
}
console.log('ALL SOCIAL AUTHZ STATIC CHECKS PASSED')
