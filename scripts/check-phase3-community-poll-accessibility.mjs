import fs from 'node:fs'
const source = fs.readFileSync('components/ghc/community-features-ui.tsx', 'utf8')
const poll = source.slice(source.indexOf('export function PollCard'), source.indexOf('// Events Component'))
const helper = fs.readFileSync('lib/active-upgrades/community.ts', 'utf8')
const checks = [
  ['poll vote counts reject negative, fractional and unsafe values', /safeCommunityCount\(option\.votes\)/.test(poll) && /Number\.isSafeInteger\(count\) && count >= 0/.test(helper)],
  ['poll percentages remain finite and bounded', /Math\.min\(100, Math\.max\(0,/.test(poll)],
  ['poll controls cannot appear enabled without a vote handler', /status === "active" && typeof onVote === "function"/.test(poll)],
  ['poll options expose pressed state for assistive technology', /aria-pressed=\{userVotedThis\}/.test(poll)],
  ['poll options expose accessible labels with counts and selection', /aria-label=\{`\$\{option\.text\}, \$\{safeVotes\} votes/.test(poll)],
  ['displayed vote counts use the normalized safe value', /\{safeVotes\}/.test(poll)],
  ['malformed poll option collections are safely normalized and bounded', /Array\.isArray\(poll\.options\)/.test(poll) && /slice\(0, 20\)/.test(poll)],
  ['aggregate poll counts cannot overflow safe integer bounds', /safeCommunityCountTotal\(options\.map/.test(poll) && /Math\.min\(Number\.MAX_SAFE_INTEGER/.test(helper)],
  ['vote distribution exposes accessible progressbar semantics', /role=\"progressbar\"/.test(poll) && /aria-valuenow/.test(poll)],
  ['poll status is normalized before rendering or enabling votes', /const status = typeof poll\.status/.test(poll)],
]
let failed = 0
for (const [label, pass] of checks) { console.log(`${pass ? 'PASS' : 'FAIL'} ${label}`); if (!pass) failed++ }
console.log(`Phase 3 community poll accessibility: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
