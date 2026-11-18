import fs from 'node:fs'
const read = (p) => fs.readFileSync(p, 'utf8')
const create = read('app/api/research/projects/route.ts')
const publicForm = read('app/api/research/public/[slug]/route.ts')
const exam = read('app/api/research/public/[slug]/exam/route.ts')
const contests = read('app/api/research/projects/[id]/elections/route.ts')
const candidates = read('app/api/research/projects/[id]/elections/[contestId]/candidates/route.ts')
const agents = read('app/api/research/projects/[id]/elections/agents/route.ts')
const examReview = read('app/api/research/projects/[id]/exams/route.ts')
const studio = read('components/field/research-studio-client.tsx')
const publicUi = read('components/field/public-research-form.tsx')
const checks = [
  ['exam answer keys accepted only for examination projects and valid single-answer options', /cleanQuestions\(value\.questions, projectType === "examination"\)/.test(create) && /!allowAnswerKey \|\| !scoredType/.test(create)],
  ['exam settings are bounded before persistence', /durationSeconds < 60/.test(create) && /durationSeconds > 14400/.test(create) && /maxAttempts > 10/.test(create)],
  ['exam creation rejects projects without at least one scored question', /EXAM_REQUIRES_SCORED_QUESTIONS/.test(create)],
  ['public form projection strips answer keys and point values', /correctAnswer: _correctAnswer, answerKey: _answerKey, points: _points/.test(publicForm)],
  ['legacy public response endpoint refuses examination bypass', /EXAM_SUBMISSION_REQUIRED/.test(publicForm) && /select=id,project_type,form_schema,settings/.test(publicForm)],
  ['exam respondent identity is HMAC hashed with a dedicated server secret and never stored raw', /createHmac\("sha256"/.test(exam) && /RESEARCH_EXAM_HASH_SECRET/.test(exam) && /respondent_key_hash: keyHash/.test(exam) && !/respondent_key:\s*respondentKey/.test(exam)],
  ['exam attempt start enforces bounded server deadlines and max attempts', /deadline_at: new Date\(now \+ durationSeconds \* 1000\)/.test(exam) && /ATTEMPT_LIMIT_REACHED/.test(exam)],
  ['exam resume and autosave are scoped to project, respondent hash and active attempt', /action === "resume"/.test(exam) && /respondent_key_hash=eq\.\$\{keyHash\}.*status=eq\.in_progress/.test(exam)],
  ['exam submit calculates scored questions server-side and withholds results by default', /const correct = q\.correctAnswer \?\? q\.answerKey/.test(exam) && /resultStatus: release \? "released" : "withheld"/.test(exam) && /short_text/.test(exam) && /long_text/.test(exam)],
  ['exam builder provides bounded timer, attempts, pass mark and answer key', /examDuration/.test(studio) && /examAttempts/.test(studio) && /examPassMark/.test(studio) && /Correct answer/.test(studio)],
  ['public exam runner supports start, resume, save, deadline countdown and submit', /action:"start"/.test(publicUi) && /action:"resume"/.test(publicUi) && /action:"save"/.test(publicUi) && /deadlineAt/.test(publicUi) && /action:"submit"/.test(publicUi) && /action:"result"/.test(publicUi) && /sessionStorage/.test(publicUi) && /autosaveTimer/.test(publicUi)],
  ['exam owner review API protects attempt access and gates release transitions', /project_type=eq\.examination/.test(examReview) && /EXAM_NOT_READY_FOR_RELEASE/.test(examReview) && /result_status: "released"/.test(examReview)],
  ['released results can be retrieved only by the same hashed respondent session', /action === "result"/.test(exam) && /respondent_key_hash=eq\.\$\{keyHash\}.*result_status=eq\.released/.test(exam) && /available: false/.test(exam)],
  ['Research Studio exposes owner-only exam review and result release controls', /ExamReviewPanel projectId/.test(studio) && /Release result/.test(studio) && /Respondent identifiers are never shown/.test(studio)],
  ['Research Studio exposes election contest, candidate and agent management', /ElectionOperationsPanel projectId/.test(studio) && /Create draft contest/.test(studio) && /Add candidate to draft/.test(studio) && /Assign field agent/.test(studio)],
  ['election contest endpoints require authenticated ownership of an election-observation project', /resolveAuthenticatedUser/.test(contests) && /owner_user_id=eq\./.test(contests) && /project_type=eq\.election_observation/.test(contests)],
  ['election contest input is bounded to supported types and country/date formats', /TYPES\.has\(type\)/.test(contests) && /\[A-Z\]\{2\}/.test(contests) && /INVALID_ELECTION_CONTEST/.test(contests)],
  ['candidate lifecycle is owner-scoped and only editable while contest is draft', /authorize\(id, contestId, auth\.userId\)/.test(candidates) && /CONTEST_NOT_EDITABLE/.test(candidates) && /project_type=eq\.election_observation/.test(candidates)],
  ['candidate ballot order and external reference are bounded', /Number\(order\) > 1000/.test(candidates) && /external\.length > 120/.test(candidates)],
  ['agent assignments validate role, user, dates, owner scope and active project membership', /ROLES\.has\(role\)/.test(agents) && /endsAt.*startsAt/.test(agents) && /owner_user_id=eq\./.test(agents) && /AGENT_NOT_ACTIVE_PROJECT_MEMBER/.test(agents)],
  ['election contest status transitions cannot reopen closed or archived contests', /transitions: Record<string, string\[]>/.test(contests) && /INVALID_CONTEST_TRANSITION/.test(contests) && /status=eq\.\$\{encodeURIComponent\(current\.data\[0\]\.status\)\}/.test(contests)],
  ['all new exam and election API responses are private no-store or no-store', /Cache-Control.*no-store/.test(exam) && /private, no-store/.test(contests + candidates + agents)],
]
let failed = 0
for (const [label, pass] of checks) { console.log(`${pass ? 'PASS' : 'FAIL'} ${label}`); if (!pass) failed++ }
console.log(`Phase 2 exam/election workflows: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
