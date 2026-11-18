#!/usr/bin/env node
import fs from 'node:fs'

const read = (path) => fs.readFileSync(path, 'utf8')
const tally = read('app/api/research/projects/[id]/elections/[contestId]/tallies/route.ts')
const wrapper = read('components/app-wrapper.tsx')
const agent = read('components/field/field-agent-tally-panel.tsx')
const communities = read('components/ghc/communities-screen.tsx')
const communityCounts = read('lib/active-upgrades/community.ts')
const studio = read('components/field/research-studio-client.tsx')
const pkg = JSON.parse(read('package.json'))
const checks = [
  ['optional tally counts use explicit number/null/invalid normalization', tally.includes('parseOptionalCount = (value: unknown): number | null | "invalid"') && tally.includes('registeredParsed === "invalid"') && tally.includes('accreditedParsed === "invalid"') && tally.includes('ballotsParsed === "invalid"')],
  ['required tally counts are normalized to number before arithmetic', tally.includes('const validVotes: number = validParsed') && tally.includes('const rejectedBallots: number = rejectedParsed')],
  ['ballot comparisons only compare normalized number values', tally.includes('totalBallots > accreditedVoters') && tally.includes('validVotes + rejectedBallots !== totalBallots')],
  ['app shell imports the exact public route policy helper', wrapper.includes('import { isPublicRoutePath } from "@/lib/routing/public-route-policy"') && wrapper.includes('isPublicRoutePath(pathname)')],
  ['field assignment model includes server-provided assignment id', agent.includes('assignmentId: string') && agent.includes('selected.assignmentId')],
  ['Communities imports useRef from React', /import \{[^}]*\buseRef\b[^}]*\} from "react"/.test(communities)],
  ['community member preview uses the resolved membership decision', communities.includes('memberPreview={joined ? [{') && !communities.includes('selected.isJoined')],
  ['community count reduction has a numeric accumulator', communityCounts.includes('values.reduce<number>')],
  ['contest and candidate effects include memoized callback dependencies', studio.includes('},[loadContests])') && studio.includes('},[loadCandidates,selected])')],
  ['exam review effect includes memoized load dependency', studio.includes('},[load])')],
  ['no exhaustive-deps suppression was introduced', !/eslint-disable[^\n]*react-hooks\/exhaustive-deps/.test(studio)],
  ['package lock remains synchronized with declared package dependencies', JSON.parse(read('package-lock.json')).packages[''].dependencies['isomorphic-dompurify'] === pkg.dependencies['isomorphic-dompurify']],
]
let failed = 0
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`)
  if (!ok) failed++
}
console.log(`\nRUN336 build cleanup: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
