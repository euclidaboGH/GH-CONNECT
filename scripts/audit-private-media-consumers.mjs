#!/usr/bin/env node
/** Static source audit only; live legacy objects/URLs are measured by supabase/phase19_readonly_preflight.sql. */
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'

const roots = ['app', 'components', 'lib']
const files = []
function walk(dir) {
  if (!fs.existsSync(dir)) return
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.next', 'dist', 'build'].includes(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full)
    else if (/\.(?:ts|tsx|js|jsx|mjs)$/.test(entry.name)) files.push(full)
  }
}
for (const root of roots) walk(root)
const findings = []
const directPublic = /https?:[^\s"'`<>]+\/storage\/v1\/object\/public\//i
const stableFacade = /\/api\/media\/(?:\$\{[^}]+\}|media_[a-z0-9_]+)\/(?:content|signed-url)/i
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8')
  const isTestOrAudit = /(?:^|\/)(?:test|audit|verify)[^/]*\.(?:mjs|ts|tsx)$/.test(file)
  if (!isTestOrAudit && directPublic.test(source)) findings.push({ file, type: 'hardcoded-public-storage-url' })
}
const serverSigner = fs.readFileSync('app/api/media/[id]/signed-url/route.ts', 'utf8')
const mediaFacade = fs.readFileSync('app/api/media/[id]/content/route.ts', 'utf8')
const upload = fs.readFileSync('app/api/media/route.ts', 'utf8')
const checks = [
  ['media delivery requires a viewer-aware authorization RPC', serverSigner.includes('gh_media_authorize_viewer') && serverSigner.includes('p_viewer_id: auth.userId')],
  ['signed URLs are short-lived', serverSigner.includes('expiresIn: 300')],
  ['media delivery does not cache private responses', serverSigner.includes('private, no-store') && mediaFacade.includes('private, no-store')],
  ['media facade validates trusted HTTPS storage origin', mediaFacade.includes('signed.protocol !== "https:"') && mediaFacade.includes('signed.origin !== trustedStorageOrigin')],
  ['new uploads do not persist public URLs', upload.includes('publicUrl: null')],
  ['source contains no hardcoded public Storage object URLs', findings.length === 0],
]
for (const [name, pass] of checks) console.log(`${pass ? 'PASS' : 'FAIL'} ${name}`)
if (findings.length) for (const finding of findings) console.error(`  ${finding.type}: ${finding.file}`)
assert.ok(checks.every(([, pass]) => pass), 'Private media source audit failed')
console.log(`Private media source audit: ${checks.length}/${checks.length} passed across ${files.length} source files.`)
console.log('NOTE: This does not prove deployed legacy data is migrated. Run supabase/phase19_readonly_preflight.sql on the target project.')
