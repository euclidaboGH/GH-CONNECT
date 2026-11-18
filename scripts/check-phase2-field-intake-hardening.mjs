import fs from 'node:fs'
const read = (path) => fs.readFileSync(path, 'utf8')
const store = read('lib/server/field/store.ts')
const report = read('app/api/field/report/route.ts')
const unlock = read('app/api/field/unlock/route.ts')
const publicResearch = read('app/api/research/public/[slug]/route.ts')
const evidenceIntent = read('app/api/research/public/[slug]/evidence/intent/route.ts')
const checks = [
  ['production field reports never fall back to process-local memory', /NODE_ENV === "production"/.test(store) && /FIELD_REPORT_STORAGE_UNAVAILABLE/.test(store)],
  ['local in-memory field reports remain available only outside production', /if \(process\.env\.NODE_ENV === "production"\)[\s\S]*?pushMemory\(report\)/.test(store)],
  ['invalid field report kinds are rejected instead of silently rewritten', /INVALID_KIND/.test(report) && /if \(!\["situation", "result", "survey", "general"\]\.includes\(kindRaw\)\)/.test(report)],
  ['field unlock rate limiting ignores caller-controlled forwarded-for values', /x-real-ip/.test(unlock) && !/x-forwarded-for/.test(unlock)],
  ['public research response rate limiting uses trusted platform IP only', /x-real-ip/.test(publicResearch) && !/x-forwarded-for/.test(publicResearch)],
  ['public evidence intent rate limiting uses trusted platform IP only', /x-real-ip/.test(evidenceIntent) && !/x-forwarded-for/.test(evidenceIntent)],
  ['rate-limit IP values are bounded and normalized', /\^\[0-9a-fA-F:\.\]\{1,64\}\$/.test(unlock) && /\^\[0-9a-fA-F:\.\]\{1,64\}\$/.test(publicResearch) && /\^\[0-9a-fA-F:\.\]\{1,64\}\$/.test(evidenceIntent)],
]
let failed = 0
for (const [label, pass] of checks) { console.log(`${pass ? 'PASS' : 'FAIL'} ${label}`); if (!pass) failed++ }
console.log(`Phase 2 field intake hardening: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
