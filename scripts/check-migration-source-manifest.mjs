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
for (let i = 0; i < actual.length; i += 1) {
  const [name, , bytes] = rows[i]
  if (name !== actual[i]) throw new Error(`Migration source manifest order/name mismatch at ${i + 1}: ${name} != ${actual[i]}`)
  const size = String(statSync(join(dir, name)).size)
  if (bytes !== size) throw new Error(`Migration source manifest byte mismatch for ${name}: ${bytes} != ${size}`)
}
console.log(`Migration source manifest: PASS (${actual.length}/${actual.length} synchronized)`)
