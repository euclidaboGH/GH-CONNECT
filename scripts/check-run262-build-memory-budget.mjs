#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const config = readFileSync(join(root, 'next.config.mjs'), 'utf8')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const errors = []
let checks = 0
const check = (condition, label) => {
  checks += 1
  if (condition) console.log(`PASS ${label}`)
  else errors.push(label)
}

check(/cpus:\s*1\b/.test(config), 'Next.js production build concurrency is bounded to one worker')
check(/webpackMemoryOptimizations:\s*true\b/.test(config), 'Next.js webpack memory optimizations are enabled')
check(/ignoreBuildErrors:\s*false/.test(config), 'production TypeScript build gate remains enabled')
check(/ignoreDuringBuilds:\s*false/.test(config), 'production ESLint build gate remains enabled')
check(pkg.engines?.node === '^24.15.0', 'supported Node 24 runtime requirement is unchanged')
check(pkg.scripts?.['prebuild:checks']?.includes('check-run262-build-memory-budget.mjs'), 'memory-budget regression guard runs in prebuild')

if (errors.length) {
  console.error(`\nRun 262 build memory budget: ${errors.length}/${checks} failed`)
  errors.forEach((error) => console.error(`FAIL ${error}`))
  process.exit(1)
}
console.log(`\nRun 262 build memory budget: ${checks}/${checks} passed.`)
