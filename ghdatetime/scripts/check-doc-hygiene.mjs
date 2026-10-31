#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = process.cwd()
const docsRoot = join(root, 'docs')
const required = new Set([
  'docs/SOURCE_OF_TRUTH.md',
  'docs/PROJECT_TRUTH.md',
  'docs/MIGRATION_CHECKLIST.md',
  'docs/POLICY_REVIEW_CHECKLIST.md',
  'docs/OPERATOR_ENV_AND_STATUS.md',
  'docs/COMMUNITY_GLOBAL_STANDARD_UPGRADE_2026-10-31.md',
  'docs/PAST_2_HOUR_CONSOLIDATION_AUDIT_2026-10-31.md',
  'docs/POST_CURATION_3_PHASE_PRODUCTION_UPGRADE_2026-10-31.md',
  'docs/PRE_PUSH_MIGRATION_AUDIT_2026-10-31.md',
  'docs/REFRESH_NOTIFICATION_UPGRADE_0.222.0_2026-10-31.md',
  'docs/REGIONAL_CONTEXT_DATE_TIME_LOCATION_UPGRADE_2026-10-31.md',
  'docs/RESIDUAL-TECH-DEBT-HARDENING-2026-10-31.md',
  'docs/UPGRADE-WORKLOG-0.222.0.md',
  'docs/WALLET_NOTIFICATION_AUDIT_0.222.0_2026-10-31.md',
])
const failures=[]
const walk=(dir)=>{
  for(const name of readdirSync(dir)){
    const p=join(dir,name)
    const rel=relative(root,p).replaceAll('\\','/')
    if(statSync(p).isDirectory()) walk(p)
    else if(rel.endsWith('.md') || rel.endsWith('.json') || rel.endsWith('.csv')) {
      if(rel === 'docs/PHASE-03-RESTORE-EVIDENCE-TEMPLATE.json' || rel === 'docs/architecture/PRODUCTION_VERIFICATION_REPORT.json') continue
      const s=readFileSync(p,'utf8')
      if(!required.has(rel) && !s.startsWith('> **LEGACY VERIFICATION FIXTURE')) {
        // Non-required docs must be explicitly current; this prevents silent historical-document growth.
        if(!/2026-10-31|0\.222\.0/.test(s)) failures.push(`unclassified documentation: ${rel}`)
      }
    }
  }
}
walk(docsRoot)
for(const p of required) if(!existsSync(join(root,p))) failures.push(`missing canonical document: ${p}`)
if(!readFileSync(join(root,'README.md'),'utf8').includes('Current source version:** `0.222.0`')) failures.push('README current version marker missing')
if(!readFileSync(join(root,'docs/PROJECT_TRUTH.md'),'utf8').includes('Current source version:** `0.222.0`')) failures.push('PROJECT_TRUTH current version marker missing')
if(!readFileSync(join(root,'docs/SOURCE_OF_TRUTH.md'),'utf8').includes('legacy documents')) failures.push('SOURCE_OF_TRUTH legacy-document rule missing')
if(failures.length){ console.error(`Documentation hygiene: ${failures.length} failure(s)`); for(const f of failures) console.error(`FAIL ${f}`); process.exit(1) }
console.log('Documentation hygiene: PASS (legacy noise isolated/marked and current source-of-truth documents present)')
