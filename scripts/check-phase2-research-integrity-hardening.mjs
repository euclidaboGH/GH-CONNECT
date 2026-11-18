import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const checks = []
const check = (name, ok) => { checks.push({ name, ok: Boolean(ok) }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`) }

const publicForm = read('components/field/public-research-form.tsx')
const submitRoute = read('app/api/research/public/[slug]/route.ts')
const foundation = read('supabase/migrations/20261116182000_gh_research_intelligence_platform_foundation.sql')
const evidence = read('supabase/migrations/20261117010001_gh_evidence_scoped_upload_chain_of_custody.sql')
const manifest = read('MIGRATION-SOURCE-MANIFEST.csv')

check('public submission keys use cryptographically secure browser randomness', publicForm.includes('crypto.getRandomValues') && !/Math\.random\(\)/.test(publicForm))
check('public form fails closed when secure browser randomness is unavailable', publicForm.includes('Secure browser randomness is unavailable'))
check('public response does not acknowledge evidence-query failures as success', submitRoute.includes('RESPONSE_EVIDENCE_RECONCILIATION_PENDING') && /if\s*\(!pendingEvidence\.ok\)/.test(submitRoute))
check('public response checks evidence attachment write result', /if\s*\(!attached\.ok\)/.test(submitRoute))
check('public response verifies final evidence binding before acknowledgement', submitRoute.includes('response_id=eq.${responseRow.id}') && submitRoute.includes('attachedEvidence.data.length'))
check('geographic units reference configured country-level geography', foundation.includes('FOREIGN KEY(country_code,level_key) REFERENCES public.gh_research_geo_levels(country_code,level_key)'))
check('geographic parent references cannot cross country boundaries', foundation.includes('FOREIGN KEY(parent_id,country_code) REFERENCES public.gh_research_geo_units(id,country_code)'))
check('election contest geography must belong to its declared country', foundation.includes('FOREIGN KEY(geo_unit_id,country_code) REFERENCES public.gh_research_geo_units(id,country_code)'))
check('election tallies cannot reference a contest owned by another project', foundation.includes('UNIQUE(id,project_id)') && foundation.includes('FOREIGN KEY(contest_id,project_id) REFERENCES public.gh_research_election_contests(id,project_id)'))
check('evidence hash-chain migration declares pgcrypto dependency', evidence.includes('CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions'))
check('unapplied research/evidence migrations remain review-gated', ['20261116182000_gh_research_intelligence_platform_foundation.sql,REVIEW_REQUIRED', '20261116190000_gh_media_evidence_engine.sql,REVIEW_REQUIRED', '20261117010001_gh_evidence_scoped_upload_chain_of_custody.sql,REVIEW_REQUIRED'].every((entry) => manifest.includes(entry)))
check('no direct anon/authenticated grants are introduced by hardening', !/GRANT\s+(?:SELECT|INSERT|UPDATE|DELETE|ALL)[\s\S]{0,100}\b(?:anon|authenticated)\b/i.test(foundation))

const failed = checks.filter(x => !x.ok)
console.log(`\nPhase 2 Research Integrity Hardening: ${checks.length - failed.length}/${checks.length} passed`)
if (failed.length) process.exit(1)
