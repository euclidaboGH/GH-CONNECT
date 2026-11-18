#!/usr/bin/env node
/** RUN332 source contract for Pi environment semantics, server-only DB grants and CI supply-chain hardening. */
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const read = (path) => readFileSync(path, 'utf8')
const env = read('.env.example')
const capabilities = read('lib/server/pi/platform-capabilities.ts')
const test = read('scripts/test-run332-pi-environment-classification.mjs')
const proposal = read('supabase/proposals/20261118_revoke_authenticated_select_server_only_tables.sql')
const securityMigration = read('supabase/migrations/20261118033839_revoke_client_select_on_server_only_tables.sql')
const ci = read('.github/workflows/ci.yml')
const security = read('.github/workflows/dependency-security.yml')
const pkg = JSON.parse(read('package.json'))
const reportPath = 'docs/RUN332-ADVANCED-PROJECT-AUDIT-AND-REMEDIATION-2026-11-18.md'
const archivedReportPath = 'docs/archive/historical-implementation-records/docs__RUN332-ADVANCED-PROJECT-AUDIT-AND-REMEDIATION-2026-11-18.md'
const migrationMap = read('docs/RUN332-MIGRATION-HISTORY-RECONCILIATION.csv')
const checks = []
const check = (name, ok) => {
  checks.push(Boolean(ok))
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
}

check('Testnet example separates Pi SDK mode from blockchain network', /PI_ENV=production/.test(env) && /PI_NETWORK=testnet/.test(env) && /NEXT_PUBLIC_PI_SANDBOX=true/.test(env))
check('Pi payout request, execution and A2U flags remain fail-closed in template', /PI_A2U_ENABLED=0/.test(env) && /PI_EARNINGS_PAYOUT_REQUESTS_ENABLED=0/.test(env) && /PI_EARNINGS_PAYOUT_EXECUTION_ENABLED=0/.test(env))
check('platform environment resolver is exported and used by capability matrix', /export function resolvePiPlatformEnvironment/.test(capabilities) && /environment = resolvePiPlatformEnvironment\(\)/.test(capabilities))
check('explicit sandbox selection takes precedence over PI_ENV production API mode', capabilities.indexOf('if (publicSandbox === "true")') >= 0 && capabilities.indexOf('if (publicSandbox === "true")') < capabilities.indexOf('if (piEnv === "production"'))
check('environment conflict cases are covered by runtime regression tests', /conflicting with Mainnet network fails closed/.test(test) && /conflicting with Testnet network fails closed/.test(test))
check('server-only grant proposal is explicitly superseded by the canonical Testnet migration', /SUPERSEDED BY APPLIED TESTNET MIGRATION/.test(proposal) && proposal.includes('20261118033839_revoke_client_select_on_server_only_tables.sql'))
check('canonical Testnet migration revokes only client SELECT and preserves service-role grants', /REVOKE SELECT ON TABLE/.test(securityMigration) && /FROM PUBLIC, anon, authenticated/.test(securityMigration) && !/GRANT\s+/i.test(securityMigration) && !/CREATE POLICY/i.test(securityMigration))
const serverOnlyTables = ['gh_verification_requests','ghc_account_flags','ghc_community_moderation_log','ghc_community_reports','ghc_connection_contexts','ghc_connection_requests','ghc_match_signals','ghc_user_blocks']
check('canonical grant migration covers all eight live Testnet server-only tables', serverOnlyTables.every((name) => securityMigration.includes(`public.${name}`)))
const clientRoots = ['components','contexts','features']
let clientReferences = []
for (const root of clientRoots) {
  if (!existsSync(root)) continue
  const visit = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) visit(path)
      else if (/\.(?:ts|tsx|js|jsx)$/.test(entry.name)) {
        const source = read(path)
        for (const table of serverOnlyTables) if (source.includes(table)) clientReferences.push(`${path}:${table}`)
      }
    }
  }
  visit(root)
}
check('server-only tables are not referenced from browser component/context/feature trees', clientReferences.length === 0)
const workflowSources = [ci, security]
const refs = workflowSources.flatMap((source) => [...source.matchAll(/^\s*-\s*uses:\s*([^\s#]+)(?:\s*#.*)?$/gm)].map((m) => m[1]))
check('CI and dependency-audit actions are pinned to full immutable commit SHAs', refs.length > 0 && refs.every((ref) => /^[^@]+@[0-9a-f]{40}$/.test(ref)))
const checkoutUses = workflowSources.reduce((n, source) => n + [...source.matchAll(/^\s*-\s*uses:\s*actions\/checkout@[0-9a-f]{40}.*$/gm)].length, 0)
const checkoutNoPersist = workflowSources.reduce((n, source) => n + [...source.matchAll(/uses:\s*actions\/checkout@[0-9a-f]{40}[\s\S]{0,100}?persist-credentials:\s*false/g)].length, 0)
check('checkout disables persisted GitHub token credentials', checkoutUses > 0 && checkoutNoPersist === checkoutUses)
check('dependency audit distinguishes registry errors from vulnerability findings and fails closed on findings', /report\.error/.test(security) && /counts\.total/.test(security) && /Security gate blocked:/.test(security) && /process\.exit\(1\)/.test(security))
check('new audit gate is wired into static verification and prebuild', ['verify:static','prebuild:checks'].every((key) => pkg.scripts[key].includes('check-run332-audit-remediation.mjs') && pkg.scripts[key].includes('test-run332-pi-environment-classification.mjs')))
check('45-row historical migration reconciliation is present with explicit match states', migrationMap.trim().split(/\r?\n/).length === 46 && migrationMap.includes('exact_version_match') && migrationMap.includes('same_slug_different_version_unverified') && migrationMap.includes('no_matching_filename'))
check('full audit report is present and preserves production no-go', (existsSync(reportPath) || existsSync(archivedReportPath)) && /Production remains NOT APPROVED/.test(read(existsSync(reportPath) ? reportPath : archivedReportPath)))
check('RUN333 Testnet follow-up and current 46-row migration map are present', (existsSync('docs/RUN333-TESTNET-SECURITY-RECONCILIATION-2026-11-18.md') || existsSync('docs/archive/historical-implementation-records/docs__RUN333-TESTNET-SECURITY-RECONCILIATION-2026-11-18.md')) && existsSync('docs/RUN333-MIGRATION-HISTORY-RECONCILIATION.csv') && read('docs/RUN333-MIGRATION-HISTORY-RECONCILIATION.csv').trim().split(/\r?\n/).length === 47)

const passed = checks.filter(Boolean).length
console.log(`\nRUN332 audit remediation: ${passed}/${checks.length} passed`)
if (passed !== checks.length) process.exit(1)
