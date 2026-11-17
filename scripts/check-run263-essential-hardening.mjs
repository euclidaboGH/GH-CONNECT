#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')
const pkg = JSON.parse(read('package.json'))
const lock = JSON.parse(read('package-lock.json'))
const next = read('next.config.mjs')
const vercel = JSON.parse(read('vercel.json'))
const ci = read('.github/workflows/ci.yml')
const truth = read('docs/SOURCE_OF_TRUTH.md')
const checks = []
const add = (ok, label) => checks.push({ ok: Boolean(ok), label })

add(pkg.engines?.node === '^24.15.0', 'Node runtime remains pinned to the supported Node 24 line')
add(lock.lockfileVersion === 3, 'npm lockfile uses deterministic lockfile v3')
add(lock.packages?.['']?.engines?.node === '^24.15.0', 'lockfile root runtime matches package engine')
add(pkg.scripts?.build === 'next build', 'production build uses the canonical Next.js compiler')
add(pkg.scripts?.typecheck === 'tsc --noEmit', 'typecheck remains a strict no-emit gate')
add(pkg.scripts?.lint?.startsWith('eslint '), 'lint remains an ESLint gate')
add(next.includes('ignoreBuildErrors: false'), 'TypeScript build errors cannot be ignored')
add(next.includes('ignoreDuringBuilds: false'), 'ESLint build errors cannot be ignored')
add(/cpus:\s*1\b/.test(next), 'Next.js build concurrency is bounded for small Vercel builders')
add(/webpackMemoryOptimizations:\s*true\b/.test(next), 'webpack memory optimizations are enabled')
add(vercel.framework === 'nextjs', 'Vercel framework is explicitly Next.js')
add(typeof vercel.installCommand === 'string' && vercel.installCommand.includes('npm ci'), 'Vercel installs from the committed lockfile')
add(typeof vercel.buildCommand === 'string' && vercel.buildCommand.includes('npm run build'), 'Vercel invokes the verified production build script')
add(ci.includes('permissions:\n  contents: read'), 'GitHub Actions uses least-privilege repository permissions')
add(ci.includes('node-version: 24.15.0'), 'CI installs the project-pinned Node runtime')
add(ci.includes('npm ci --legacy-peer-deps'), 'CI performs a clean lockfile install')
add(ci.includes('npm run typecheck'), 'CI runs TypeScript validation')
add(ci.includes('npm run lint'), 'CI runs lint validation')
add(ci.includes('node scripts/check-database-rls-coverage.mjs') && ci.includes('node scripts/check-security-definer-acl.mjs'), 'CI gates database RLS and privileged RPC ACL contracts')
add(!/supabase\s+db\s+push|supabase\s+migration\s+up|apply_migration/i.test(ci), 'CI cannot automatically mutate the live database schema')

for (const item of checks) console.log(`${item.ok ? 'PASS' : 'FAIL'} ${item.label}`)
const failed = checks.filter((item) => !item.ok)
if (failed.length) {
  console.error(`\nRun 263 essential hardening: ${failed.length}/${checks.length} failed`)
  process.exit(1)
}
console.log(`\nRun 263 essential hardening: ${checks.length}/${checks.length} passed.`)
