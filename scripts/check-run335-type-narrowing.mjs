import fs from "node:fs"

const read = (path) => fs.readFileSync(path, "utf8")
const tally = read("app/api/research/projects/[id]/elections/[contestId]/tallies/route.ts")
const studio = read("components/field/research-studio-client.tsx")
const checks = [
  ["optional election counts use explicit number/null/invalid normalization", tally.includes('parseOptionalCount = (value: unknown): number | null | "invalid"') && tally.includes('registeredParsed === "invalid"') && tally.includes('accreditedParsed === "invalid"') && tally.includes('ballotsParsed === "invalid"')],
  ["required counts are explicitly narrowed before arithmetic", tally.includes("const validVotes: number = validParsed") && tally.includes("const rejectedBallots: number = rejectedParsed") && tally.includes("parseRequiredCount = (value: unknown): number | null")],
  ["ballot-total comparisons operate on narrowed numeric values", tally.includes("validVotes + rejectedBallots !== totalBallots") && tally.includes("totalBallots > accreditedVoters") && !tally.includes("function countOk")],
  ["election contest loader is memoized against project identity", studio.includes("const loadContests=useCallback(async()") && studio.includes("},[projectId])") && studio.includes("},[loadContests])")],
  ["candidate loader effect includes callback and selected contest dependencies", studio.includes("const loadCandidates=useCallback(async(contestId:string)") && studio.includes("},[loadCandidates,selected])")],
  ["reconciliation loader is memoized against project and contest", studio.includes("},[projectId,contestId])") && studio.includes("useEffect(()=>{void load()},[load])")],
  ["exam loader effect includes its memoized callback dependency", studio.includes("const load=useCallback(async()=>") && studio.includes("useEffect(()=>{void load().catch") && studio.includes("},[load])")],
  ["no blanket exhaustive-deps suppression was introduced", !/eslint-disable[^\n]*react-hooks\/exhaustive-deps/.test(studio)],
]
let failed = 0
for (const [label, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`)
  if (!ok) failed++
}
console.log(`\nRUN335 build regression checks: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
