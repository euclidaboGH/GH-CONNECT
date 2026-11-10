#!/usr/bin/env node
/** Source regression checks for Phase 3 database recovery safeguards. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
const root = process.cwd()
const verifier = readFileSync(join(root, 'scripts/verify-database-backup-artifact.mjs'), 'utf8')
const evidenceValidator = readFileSync(join(root, 'scripts/validate-database-restore-evidence.mjs'), 'utf8')
const evidenceTemplate = readFileSync(join(root, 'docs/PHASE-03-RESTORE-EVIDENCE-TEMPLATE.json'), 'utf8')
const catalogGate = readFileSync(join(root, 'supabase/VALIDATE-RESTORED-DATABASE.sql'), 'utf8')
const catalogCheck = readFileSync(join(root, 'scripts/check-phase3-restore-catalog-gate.mjs'), 'utf8')
const runbook = readFileSync(join(root, 'docs/PHASE-03-DATABASE-INTEGRITY-RECOVERY.md'), 'utf8')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const checks = [
  ['backup verification is read-only and makes no database connection', /without connecting to or modifying any database/.test(verifier) && !/createConnection|DATABASE_URL|supabase db push/.test(verifier)],
  ['artifact verifier computes SHA-256', /createHash\('sha256'\)/.test(verifier)],
  ['artifact verifier validates age and minimum size', /max-age-hours/.test(verifier) && /min-bytes/.test(verifier)],
  ['artifact verifier checks PostgreSQL archive catalog', /pg_restore.*--list/.test(verifier) && /Format:\\s\*CUSTOM/.test(verifier)],
  ['artifact verification explicitly does not claim restore success', /isolated restore drill is still required/.test(verifier)],
  ['runbook requires isolated restore rehearsal', /isolated.*restore|restore.*isolated/i.test(runbook)],
  ['runbook separates client snapshots from database backups', /not a durable PostgreSQL backup/i.test(runbook)],
  ['runbook prohibits production restore drills', /Never rehearse a restore against production/i.test(runbook)],
  ['runbook records RPO and RTO as targets requiring owner approval', /proposed starting targets only/i.test(runbook) && /must approve them before they become commitments/i.test(runbook)],
  ['package exposes Phase 3 recovery checks', pkg.scripts?.['check:phase3-database-recovery'] === 'node scripts/check-phase3-database-recovery.mjs'],
  ['restore validation SQL is explicitly read-only', /BEGIN TRANSACTION READ ONLY/i.test(catalogGate)],
  ['restore validation covers RLS and SECURITY DEFINER ACL/search_path', /NOT c\.relrowsecurity/.test(catalogGate) && /acl\.grantee = 0/.test(catalogGate) && /search_path=/.test(catalogGate)],
  ['restore validation has its own source regression suite', /check-phase3-restore-catalog-gate/.test(catalogCheck) && pkg.scripts?.['check:phase3-restore-catalog-gate'] === 'node scripts/check-phase3-restore-catalog-gate.mjs'],
  ['restore evidence validator checks disposable environment and no production credentials', /environment === 'disposable'/.test(evidenceValidator) && /production_credentials_used === false/.test(evidenceValidator)],
  ['restore evidence validator requires digest, timestamps, integrity and smoke tests', /backup_sha256/.test(evidenceValidator) && /restore_started_at/.test(evidenceValidator) && /integrity_checks/.test(evidenceValidator) && /smoke_tests/.test(evidenceValidator)],
  ['restore evidence validator rejects credential-bearing evidence', /database_url\|connection_string\|password\|secret\|service_role_key/.test(evidenceValidator)],
  ['restore evidence validator is registered in package commands', pkg.scripts?.['validate:database-restore-evidence'] === 'node scripts/validate-database-restore-evidence.mjs'],
  ['restore evidence validator caps input at 256 KiB and requires an object', /256 \* 1024/.test(evidenceValidator) && /Array\.isArray\(record\)/.test(evidenceValidator)],
  ['successful restore evidence requires measured RPO/RTO and post-restore review', /successful drill includes measured RPO and RTO/.test(evidenceValidator) && /review occurred after restore completion/.test(evidenceValidator)],
  ['restore evidence timestamps require timezone and valid calendar dates', /Require an explicit timezone/.test(evidenceValidator) && /getUTCDate\(\) !== day/.test(evidenceValidator)],
  ['PostgreSQL version must match a recognizable version format', /recognizable form/.test(evidenceValidator) && /postgres_version\.trim\(\)/.test(evidenceValidator)],
  ['evidence timestamps reject impossible clock times and timezone offsets', /hour > 23 \|\| minute > 59 \|\| second > 59/.test(evidenceValidator) && /Number\(offset\[2\]\) > 14/.test(evidenceValidator)],
  ['evidence requires unique named checks and an independent reviewer label', /uniqueNamedChecks/.test(evidenceValidator) && /independentReviewer/.test(evidenceValidator)],
  ['behavioral tests cover malicious and incomplete evidence', pkg.scripts?.['test:database-restore-evidence'] === 'node scripts/test-database-restore-evidence-validator.mjs' && /oversized evidence rejected/.test(readFileSync(join(root, 'scripts/test-database-restore-evidence-validator.mjs'), 'utf8')) && /impossible calendar date rejected/.test(readFileSync(join(root, 'scripts/test-database-restore-evidence-validator.mjs'), 'utf8')) && /duplicate integrity check names rejected/.test(readFileSync(join(root, 'scripts/test-database-restore-evidence-validator.mjs'), 'utf8'))],
  ['evidence template is intentionally non-passing until populated', /replace-with-64-character/.test(evidenceTemplate) && /\"restore_status\": \"fail\"/.test(evidenceTemplate) && /not_run/.test(evidenceTemplate)],
]
let failed = 0
for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) failed++ }
console.log(`Phase 3 database recovery contract: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
