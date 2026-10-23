#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const json = (file) => JSON.parse(read(file))
const checks = []
const check = (label, condition) => {
  checks.push({ label, pass: Boolean(condition) })
  console.log(`${condition ? 'PASS' : 'FAIL'} ${label}`)
}

const pkg = json('package.json')
const lock = json('package-lock.json')
const nextConfig = read('next.config.mjs')
const vercel = json('vercel.json')
const env = read('.env.example')
const runtime = read('scripts/check-node-runtime.mjs')
const nvmrc = read('.nvmrc').trim()
const ci = pkg.scripts?.['ci:verify'] ?? ''

check('Node 24 is the sole supported production engine', pkg.engines?.node === '^24.15.0')
check('package-lock repeats the Node 24 engine contract', lock.packages?.['']?.engines?.node === '^24.15.0')
check('.nvmrc pins Node 24.15.0', nvmrc === '24.15.0')
check('runtime guard accepts Node 24.15+', /major === 24/.test(runtime) && /minor > 15/.test(runtime) && /minor === 15 && patch >= 0/.test(runtime))
check('runtime guard no longer advertises Node 22', !runtime.includes('^22.22.2'))
check('Vercel uses canonical npm build command', vercel.buildCommand === 'npm run build')
check('Vercel uses clean reproducible npm install', vercel.installCommand === 'npm ci --legacy-peer-deps')
check('Next build does not ignore TypeScript errors', !/ignoreBuildErrors\s*:\s*true/.test(nextConfig))
check('Next build does not ignore ESLint errors', !/ignoreDuringBuilds\s*:\s*true/.test(nextConfig))
check('build script invokes Next production build', pkg.scripts?.build === 'ESLINT_USE_FLAT_CONFIG=false next build')
check('Vercel build alias matches build script', pkg.scripts?.['vercel-build'] === 'npm run build')
check('CI verification includes real typecheck', ci.includes('npm run typecheck'))
check('CI verification includes real lint', ci.includes('npm run lint'))
check('CI verification includes real production build', ci.includes('npm run build'))
check('production env template does not contain secrets', !/(SUPABASE_SERVICE_ROLE_KEY|PI_SERVER_API_KEY|PI_WALLET_PRIVATE_SEED|PAYSTACK_SECRET_KEY)=\S+/.test(env))
check('Pi sandbox defaults to testnet-safe mode', /NEXT_PUBLIC_PI_SANDBOX=true/.test(env) && /PI_ENV=testnet/.test(env))
check('withdrawals default disabled', /GHC_WITHDRAWALS_ENABLED=false/.test(env))
check('Pi A2U defaults disabled', /PI_A2U_ENABLED=false/.test(env))
check('Next config keeps TypeScript strictness in tsconfig', /"strict": true/.test(read('tsconfig.json')))
check('incremental TypeScript state is ignored from release artifacts', /\*\.tsbuildinfo/.test(read('.gitignore')))

const failed = checks.filter((x) => !x.pass)
console.log(`\nPHASE 41 PRODUCTION BUILD CONTRACT: ${checks.length - failed.length}/${checks.length} passed`)
if (failed.length) process.exitCode = 1
