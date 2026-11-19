#!/usr/bin/env node
/** RUN337 guards the safe environment template and honest npm audit reporting. */
import { readFileSync, existsSync } from 'node:fs'

const checks = []
const check = (name, ok) => {
  checks.push(Boolean(ok))
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
}
const env = existsSync('.env.example') ? readFileSync('.env.example', 'utf8') : ''
const workflow = readFileSync('.github/workflows/dependency-security.yml', 'utf8')
const auditGate = workflow.slice(workflow.indexOf('- name: Enforce zero known vulnerabilities'))

check('safe root environment template is included in source tree', env.length > 0)
check('template keeps privileged credentials blank', [
  'SUPABASE_SERVICE_ROLE_KEY=', 'PI_SERVER_API_KEY=', 'PI_WALLET_PRIVATE_SEED=', 'PI_EARNINGS_EXECUTOR_KEY=', 'CRON_SECRET=',
].every((key) => new RegExp(`^${key.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\s*$`, 'm').test(env)))
check('Pi Testnet template preserves fail-closed payout and A2U defaults', /PI_ENV=production/.test(env) && /PI_NETWORK=testnet/.test(env) && /NEXT_PUBLIC_PI_SANDBOX=true/.test(env) && /PI_A2U_ENABLED=0/.test(env) && /PI_EARNINGS_PAYOUT_REQUESTS_ENABLED=0/.test(env) && /PI_EARNINGS_PAYOUT_EXECUTION_ENABLED=0/.test(env))
check('Git ignores local env secrets and Vercel excludes them explicitly without filtering .env.example', /\.env\.\*/.test(readFileSync('.gitignore', 'utf8')) && /!\.env\.example/.test(readFileSync('.gitignore', 'utf8')) && ['.env', '.env.local', '.env.development.local', '.env.test.local', '.env.production.local'].every((name) => readFileSync('.vercelignore', 'utf8').split(/\r?\n/).map((line) => line.trim()).includes(name)) && !readFileSync('.vercelignore', 'utf8').split(/\r?\n/).map((line) => line.trim()).includes('.env*'))
check('audit workflow distinguishes npm audit vulnerability exit from registry/report errors', /report\.error/.test(auditGate) && /counts\.total/.test(auditGate) && /Security gate blocked:/.test(auditGate) && !/npm audit command failed with exit code/.test(auditGate))
check('audit remains fail-closed when any known vulnerability is present', /if \(total > 0\)/.test(auditGate) && /process\.exit\(1\)/.test(auditGate))
check('audit report artifact remains retained for investigation', /Upload full advisory report/.test(workflow) && /retention-days: 30/.test(workflow))

const passed = checks.filter(Boolean).length
console.log(`\nRUN337 GitHub audit recovery: ${passed}/${checks.length} passed`)
if (passed !== checks.length) process.exit(1)
