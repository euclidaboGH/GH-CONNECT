#!/usr/bin/env node
import fs from 'fs'
import path from 'path'

const root = process.cwd()
const dir = path.join(root, 'app/api/communities')
const files = []
function walk(d) {
  if (!fs.existsSync(d)) return
  for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, ent.name)
    if (ent.isDirectory()) walk(p)
    else if (ent.name === 'route.ts') files.push(p)
  }
}
walk(dir)

let pass = 0, fail = 0
const issues = []
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8')
  const rel = path.relative(root, f)
  if (!/resolveAuthenticatedUser/.test(src) && !/GET/.test(src)) {
    issues.push(`${rel}: missing auth`)
    fail++; continue
  }
  // Mutations must auth
  if (/(export async function POST|export async function DELETE|export async function PATCH)/.test(src)) {
    if (!/resolveAuthenticatedUser/.test(src)) {
      issues.push(`${rel}: mutation without resolveAuthenticatedUser`)
      fail++; continue
    }
  }
  if (/createdBy:\s*body\.|ownerId:\s*auth\.userId\s*\|\||createdBy:\s*String\(body/.test(src)) {
    issues.push(`${rel}: suspicious client ownership`)
    fail++; continue
  }
  if (/p_user_id:\s*body\.|p_actor_id:\s*body\./.test(src)) {
    issues.push(`${rel}: body as actor`)
    fail++; continue
  }
  pass++
}

// posts community membership check present
const posts = fs.readFileSync(path.join(root, 'app/api/social/posts/route.ts'), 'utf8')
if (!/gh_community_member_role/.test(posts)) {
  issues.push('posts/route.ts: missing community membership check')
  fail++
} else pass++

console.log(`Community authz: ${pass} pass, ${fail} fail`)
if (issues.length) {
  for (const i of issues) console.log(' FAIL', i)
  process.exit(1)
}
console.log('ALL COMMUNITY AUTHZ CHECKS PASSED')
