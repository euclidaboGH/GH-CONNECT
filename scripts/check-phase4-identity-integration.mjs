import fs from 'node:fs'
import path from 'node:path'
const root = process.cwd()
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8')
const pkg = JSON.parse(read('package.json'))
const lock = JSON.parse(read('package-lock.json'))
const checks = [
  ['release versions agree with current package version', Boolean(pkg.version) && lock.version === pkg.version && lock.packages?.['']?.version === pkg.version],
  ['release summary matches package version', read('lib/app-release.ts').includes(`APP_RELEASE_VERSION = "${pkg.version}"`)],
  ['main feed imports canonical identity hydrator', /hydratePublicProfileIdentity/.test(read('app/api/social/feed/route.ts'))],
  ['main feed hydrates post authors and nested comment previews', /posts = await hydratePublicProfileIdentity/.test(read('app/api/social/feed/route.ts')) && /hydratePublicProfileIdentity\(allComments\)/.test(read('app/api/social/feed/route.ts'))],
  ['search imports canonical identity hydrator', /hydratePublicProfileIdentity/.test(read('app/api/social/search/route.ts'))],
  ['search hydrates people, posts, videos and creators', ['hydratedPeople','hydratedPosts','hydratedVideos','hydratedCreators'].every((name) => read('app/api/social/search/route.ts').includes(name))],
  ['shared helper selects only public identity columns', /select:\s*"gh_user_id,display_name,username,photos"/.test(read('lib/server/identity/public-profile-hydration.ts'))],
  ['shared helper uses no-store reads', /cache:\s*"no-store"/.test(read('lib/server/identity/public-profile-hydration.ts'))],
  ['no new database migration is bundled for identity hydration', !fs.readdirSync(path.join(root, 'supabase/migrations')).some((name) => /phase4.*identity/i.test(name))],
  ['Phase 4 documentation exists', fs.existsSync(path.join(root, 'PHASE-4-CROSS-FEATURE-IDENTITY-INTEGRATION.md'))],
]
let failed = 0
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failed++ }
console.log(`Phase 4 identity integration: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
