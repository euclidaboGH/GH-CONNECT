import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')
const pkg = JSON.parse(read('package.json'))
const lock = JSON.parse(read('package-lock.json'))
const migrationDir = join(root, 'supabase/migrations')
const migrations = readdirSync(migrationDir).filter((name) => name.endsWith('.sql'))
const checklist = read('docs/MIGRATION_CHECKLIST.md')
const manifest = read('VERIFIED_MANIFEST.txt')
const readme = read('README.md')
const deploy = read('VERCEL_DEPLOY.txt')
const gate = read('docs/TESTNET_VERIFICATION_GATE.md')
const phase14 = read('docs/GH_PHASE_14.md')
const phase15 = read('docs/GH_PHASE_15_PREPARATION.md')
const truth = read('docs/PROJECT_TRUTH.md')
const status = read('docs/PHASE_IMPLEMENTATION_STATUS.md')
const errors = []
let total = 0
const pass = (label) => console.log(`PASS ${label}`)
const fail = (label) => errors.push(label)

const classes = ['REQUIRED', 'REQUIRES_APPROVAL', 'PROPOSAL', 'REVIEW_REQUIRED']
const rowClasses = [...checklist.matchAll(/^\|\s*\d+\s*\|\s*`[^`]+\.sql`\s*\|\s*(REQUIRED|REQUIRES_APPROVAL|PROPOSAL|REVIEW_REQUIRED)\s*\|/gm)].map((match) => match[1])
const counts = Object.fromEntries(classes.map((kind) => [kind, rowClasses.filter((value) => value === kind).length]))
const expectedHeader = `**On-disk count:** **${migrations.length}**`
const expectedClassLine = `**Classification:** REQUIRED **${counts.REQUIRED}** · REQUIRES_APPROVAL **${counts.REQUIRES_APPROVAL}** · PROPOSAL **${counts.PROPOSAL}** · REVIEW_REQUIRED **${counts.REVIEW_REQUIRED}**`

function check(condition, label) {
  total += 1
  if (condition) pass(label)
  else fail(label)
}

check(pkg.version === lock.version && pkg.version === lock.packages?.['']?.version, 'package.json and lockfile root versions match')
check(readme.includes(`Current source version:** \`${pkg.version}\``), 'README current baseline matches package version')
check(deploy.includes(`Current source release: ${pkg.version}`), 'deployment runbook version matches package version')
check(checklist.includes(expectedHeader), 'generated checklist migration count matches canonical directory')
check(checklist.includes(expectedClassLine), 'generated checklist class counts match its migration rows')
check(manifest.includes(`project_version=${pkg.version}`), 'verified manifest version matches package version')
check(manifest.includes(`canonical_migrations=${migrations.length}`), 'verified manifest migration count matches canonical directory')
check(gate.includes(`Canonical on-disk count: **${migrations.length}**`), 'Testnet gate uses current canonical migration count')
check(gate.includes(`**${counts.REQUIRED} REQUIRED**`) && gate.includes(`**${counts.REQUIRES_APPROVAL} REQUIRES_APPROVAL**`) && gate.includes(`**${counts.PROPOSAL} PROPOSAL**`) && gate.includes(`**${counts.REVIEW_REQUIRED} REVIEW_REQUIRED**`), 'Testnet gate uses all current migration classifications')
check(!gate.includes('Canonical on-disk count: **70**') && !gate.includes('67 REQUIRED') && !gate.includes('Apply oldest → newest'), 'Testnet gate contains no stale inventory or blanket-apply instruction')
check(!phase14.includes('51 REQUIRED migrations') && !phase15.includes('51 REQUIRED migrations'), 'Phase 14/15 operator guidance has no stale 51-migration count')
check(status.includes(`current package version is \`${pkg.version}\``) && truth.includes(`**Current source version:** \`${pkg.version}\``), 'authoritative status documents match current source version')
check(truth.toLowerCase().includes('not approved') && truth.includes('does not prove that any migration is applied'), 'project truth explicitly separates source inventory from release approval')
check(pkg.scripts?.['check:project-truth'] === 'node scripts/check-project-truth.mjs', 'project-truth check is registered in npm scripts')

if (errors.length) {
  console.error(`\nProject truth check: ${errors.length} failure(s)`)
  for (const error of errors) console.error(`FAIL ${error}`)
  process.exit(1)
}
console.log(`\nProject truth check: ${total} checks passed, 0 failures.`)
