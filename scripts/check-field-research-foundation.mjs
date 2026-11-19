#!/usr/bin/env node
import fs from 'node:fs'
const read = (p) => fs.readFileSync(p, 'utf8')
const access = read('lib/server/field/access.ts')
const store = read('lib/server/field/store.ts')
const client = read('components/field/field-desk-client.tsx')
const registry = read('lib/navigation/service-registry.ts')
const ecosystem = read('components/ghc/greenhaven-ecosystem-screen.tsx')
const plan = read('docs/FIELD-RESEARCH-PLATFORM-UPGRADE-PLAN.md')
const studio = read('components/field/research-studio-client.tsx')
const publicForm = read('components/field/public-research-form.tsx')
const inbox = read('app/api/research/projects/[id]/responses/route.ts')
const migration = read('supabase/migrations/20261116171144_gh_research_studio_public_forms.sql')
const projectsApi = read('app/api/research/projects/route.ts')
const publicApi = read('app/api/research/public/[slug]/route.ts')
const publishApi = read('app/api/research/projects/[id]/route.ts')
const studioPage = read('app/field/studio/page.tsx')
const checks = [
  ['field session signing requires dedicated secret', /const s = process\.env\.GHC_FIELD_SESSION_SECRET/.test(access) && !/GHC_AUTH_JWT_SECRET/.test(access)],
  ['access code verifier supports requested four-digit and five-digit codes', /s\.length >= 4/.test(access) && /supplied\.length < 4/.test(access)],
  ['access code comparison remains timing-safe', /timingSafeEqual/.test(access)],
  ['field portal is browser accessible and professionally titled', /Field Research/.test(client) && /PUBLIC PORTAL/.test(client)],
  ['agent workspace has overview/report/survey navigation', /overview/.test(client) && /report/.test(client) && /surveys/.test(client)],
  ['field research appears in Ecosystem research category', /id: "research"/.test(registry) && /id: "field-research"/.test(registry)],
  ['suspended Field Research has no direct ecosystem navigation path', !/location\.assign\("\/field\/studio"\)/.test(ecosystem) && /id: "field-research"[\s\S]*?status: "UNAVAILABLE"[\s\S]*?destination: \{ kind: "none" \}/.test(registry)],
  ['durable configured storage fails closed instead of acknowledging memory fallback', /FIELD_REPORT_PERSIST_FAILED/.test(store) && /never acknowledge a process-local write/.test(store)],
  ['thirty-track programmes exist for all three requested product areas', (plan.match(/## Field Research — 30 upgrade tracks|## Challenge-on-Post — 30 upgrade tracks|## Polls-on-Post — 30 upgrade tracks/g) || []).length === 3],
  ['owner-facing visual Research Studio is implemented', /Create research/.test(studio) && /Add question/.test(studio) && /Publish form/.test(studio)],
  ['public share-link response portal is implemented', /PublicResearchForm/.test(publicForm) && /Submit response/.test(publicForm)],
  ['owner inbox is private and ownership-checked', /owner_user_id=eq\./.test(inbox) && /gh_research_responses/.test(inbox)],
  ['research schema enables RLS and revokes direct client access', /ENABLE ROW LEVEL SECURITY/.test(migration) && /REVOKE ALL ON TABLE/.test(migration)],
  ['project create/list APIs require GreenHaven owner authentication', /resolveAuthenticatedUser/.test(projectsApi) && /owner_user_id: auth.userId/.test(projectsApi)],
  ['project updates are scoped to the authenticated owner', /owner_user_id=eq/.test(publishApi) && /resolveAuthenticatedUser/.test(publishApi)],
  ['public forms expose published projects only', /status=eq.published/.test(publicApi)],
  ['public submissions require explicit consent and server-side validation', /CONSENT_AND_ANSWERS_REQUIRED/.test(publicApi) && /REQUIRED_ANSWER_MISSING/.test(publicApi) && /INVALID_ANSWER/.test(publicApi)],
  ['public submissions are bounded, rate-limited and idempotent', /readBoundedJson\(request, 64 \* 1024\)/.test(publicApi) && /checkDurableRateLimit/.test(publicApi) && /on_conflict=project_id,submission_key/.test(publicApi)],
  ['opaque share links use high-entropy random slugs', /randomBytes\(18\)/.test(projectsApi)],
  ['visual preview provides interactive response controls', /previewAnswers/.test(studio) && /Preview/.test(studio)],
  ['sharing supports WhatsApp, Facebook and GreenHaven Messages', /whatsapp/.test(studio) && /facebook/.test(studio) && /\/\?tab=messages/.test(studio)],
  ['election observation starter includes geographic and tally fields', /Senatorial District \/ Zone/.test(studio) && /Polling Unit name or code/.test(studio) && /Votes recorded for this candidate/.test(studio)],
  ['Research Studio page is registered', /ResearchStudioClient/.test(studioPage)],
]
let failed = 0
for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) failed++ }
console.log(`Field Research foundation: ${checks.length - failed}/${checks.length} passed`)
process.exit(failed ? 1 : 0)
