import fs from 'node:fs'
const checks = [
  ['legacy display URL export is available', fs.readFileSync('lib/media/resolve-display-url.ts','utf8').includes('export async function resolveDisplayUrl(')],
  ['group cover upload narrows durable result', /if \(uploaded\.ok\)\s*\{[\s\S]*?uploaded\.url/.test(fs.readFileSync('components/ghc/create-group-modal.tsx','utf8'))],
  ['group upload preserves errors on failure', fs.readFileSync('components/ghc/create-group-modal.tsx','utf8').includes('uploaded.userMessage')],
  ['marketplace upload narrows durable result', /uploaded\.ok \? toRelativeMediaFacadeUrl\(String\(uploaded\.url\)\)/.test(fs.readFileSync('components/ghc/marketplace-screen.tsx','utf8'))],
  ['likes-you tab state matches component contract', /useState<"new" \| "all" \| "likes_you">\("new"\)/.test(fs.readFileSync('components/ghc/match-screen.tsx','utf8'))],
  ['likes-you rows are derived from inbound likes', /like\.toUserId\) === String\(meId\)/.test(fs.readFileSync('components/ghc/match-screen.tsx','utf8'))],
  ['likes-you list excludes blocked users', /!blockedSet\.has\(String\(like\.fromUserId\)\)/.test(fs.readFileSync('components/ghc/match-screen.tsx','utf8'))],
  ['likes-you list excludes existing matches', /!matchedUserIds\.has\(String\(like\.fromUserId\)\)/.test(fs.readFileSync('components/ghc/match-screen.tsx','utf8'))],
]
let failed = 0
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failed++ }
console.log(`Build blocker repair checks: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exitCode = 1
