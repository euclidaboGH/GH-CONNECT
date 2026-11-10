import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const dir = join(root, 'supabase', 'migrations')
const manifestPath = join(root, 'MIGRATION-SOURCE-MANIFEST.csv')
const actual = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
const lines = readFileSync(manifestPath, 'utf8').trim().split(/\r?\n/)
if (lines.shift() !== 'filename,classification,bytes') throw new Error('Migration source manifest header mismatch')
const rows = lines.map((line) => {
  const m = line.match(/^([^,]+),(REQUIRED|REQUIRES_APPROVAL|PROPOSAL|REVIEW_REQUIRED),(\d+)$/)
  if (!m) throw new Error(`Invalid migration source manifest row: ${line}`)
  return m.slice(1)
})
if (rows.length !== actual.length) throw new Error(`Migration source manifest count ${rows.length} != SQL migration count ${actual.length}`)
const classificationCounts = { REQUIRED: 0, REQUIRES_APPROVAL: 0, PROPOSAL: 0, REVIEW_REQUIRED: 0 }
const sourceClasses = new Map()
for (let i = 0; i < actual.length; i += 1) {
  const [name, classification, bytes] = rows[i]
  if (name !== actual[i]) throw new Error(`Migration source manifest order/name mismatch at ${i + 1}: ${name} != ${actual[i]}`)
  const size = String(statSync(join(dir, name)).size)
  if (bytes !== size) throw new Error(`Migration source manifest byte mismatch for ${name}: ${bytes} != ${size}`)
  classificationCounts[classification] += 1
  sourceClasses.set(name, classification)
}
const verified = readFileSync(join(root, 'VERIFIED_MANIFEST.txt'), 'utf8')
const verifiedRows = [...verified.matchAll(/^\[(REQUIRED|REQUIRES_APPROVAL|PROPOSAL|REVIEW_REQUIRED)\] size=\d+ path=supabase\/migrations\/(.+)$/gm)]
if (verifiedRows.length !== actual.length) throw new Error(`Verified manifest has ${verifiedRows.length} classified migrations; expected ${actual.length}`)
for (const [, classification, name] of verifiedRows) {
  if (sourceClasses.get(name) !== classification) throw new Error(`Classification drift for ${name}: CSV=${sourceClasses.get(name)}; verified manifest=${classification}`)
}
const checklist = readFileSync(join(root, 'docs', 'MIGRATION_CHECKLIST.md'), 'utf8')
const expectedCountLine = `**Classification:** REQUIRED **${classificationCounts.REQUIRED}** · REQUIRES_APPROVAL **${classificationCounts.REQUIRES_APPROVAL}** · PROPOSAL **${classificationCounts.PROPOSAL}** · REVIEW_REQUIRED **${classificationCounts.REVIEW_REQUIRED}**`
if (!checklist.includes(expectedCountLine)) throw new Error('Migration checklist classification totals do not match the source manifest')
const applyGuide = readFileSync(join(root, 'supabase', 'TESTNET_APPLY_ORDER.md'), 'utf8')
const applyRows = [...applyGuide.matchAll(/^\| \d+ \| `([^`]+)` \| (REQUIRED|REQUIRES_APPROVAL|PROPOSAL|REVIEW_REQUIRED) \| ([A-Z_]+) \|$/gm)]
if (applyRows.length !== actual.length) throw new Error(`Testnet apply guide has ${applyRows.length} entries; expected ${actual.length}`)
for (let i = 0; i < actual.length; i += 1) {
  const [ , name, classification, action ] = applyRows[i]
  const expectedAction = ['20261110182120_community_chat_membership_revocation_and_reconciliation.sql','20261110183004_community_server_filter_search_reconciliation.sql'].includes(name) ? 'APPLIED_TESTNET_ONLY_HOLD_OTHER_TARGETS' : name === '20261108120001_gh_community_server_filter_search.sql' ? 'SUPERSEDED_BY_COMMUNITY_SEARCH_TESTNET_PATCH_HOLD_OTHER_TARGETS' : classification === 'REQUIRED' ? 'REVIEW_THEN_APPLY' : classification === 'REQUIRES_APPROVAL' ? 'HOLD_APPROVAL' : classification === 'PROPOSAL' ? 'DO_NOT_APPLY' : 'HOLD_VALIDATION'
  if (name !== actual[i] || classification !== sourceClasses.get(actual[i]) || action !== expectedAction) {
    throw new Error(`Testnet apply guide drift at row ${i + 1}: ${name}/${classification}/${action}`)
  }
}
console.log(`Migration source manifest: PASS (${actual.length}/${actual.length}; classifications, verified manifest, checklist and Testnet guide synchronized)`)
