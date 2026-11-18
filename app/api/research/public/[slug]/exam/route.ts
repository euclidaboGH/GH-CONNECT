import { NextResponse } from "next/server"
import { createHmac, randomInt, randomUUID } from "node:crypto"
import { supabaseRest, getServiceSupabaseConfig } from "@/lib/server/supabase/rest-client"
import { readBoundedJson } from "@/lib/server/http/read-bounded-json"
import { checkDurableRateLimit, durableRateLimitCode, durableRateLimitStatus } from "@/lib/server/security/control-plane"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }
type ExamQuestion = { id: string; type: string; title?: string; label?: string; required?: boolean; options?: string[]; points?: number; correctAnswer?: unknown; answerKey?: unknown; showWhen?: unknown }
type ExamConfig = { enabled?: boolean; durationSeconds?: number; maxAttempts?: number; passPercentage?: number; shuffleQuestions?: boolean; shuffleChoices?: boolean; resultRelease?: "immediate" | "manual" }
const asObject = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
const shuffle = <T,>(items: T[]) => { const out = [...items]; for (let i = out.length - 1; i > 0; i--) { const j = randomInt(i + 1); [out[i], out[j]] = [out[j], out[i]] } return out }
const cleanQuestion = (q: ExamQuestion) => { const { correctAnswer: _a, answerKey: _b, points: _p, ...safe } = q; return safe }
function respondentHash(key: string) {
  const secret = process.env.RESEARCH_EXAM_HASH_SECRET
  if (!secret || secret.length < 32) return null
  return createHmac("sha256", secret).update(key).digest("hex")
}
function validQuestion(q: ExamQuestion) {
  return typeof q.id === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(q.id) && (["short_text", "long_text"].includes(q.type) || (["single_choice", "dropdown"].includes(q.type) && Array.isArray(q.options) && q.options.length >= 2 && q.options.length <= 30 && q.options.every((v) => typeof v === "string" && v.length <= 180)))
}
function normalizeAnswer(value: unknown, q: ExamQuestion) {
  if (typeof value !== "string") return null
  if (["single_choice", "dropdown"].includes(q.type)) return (q.options || []).includes(value) ? value : null
  const limit = q.type === "short_text" ? 1000 : q.type === "long_text" ? 4000 : 0
  if (!limit || value.length > limit || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) return null
  return value.trim()
}

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(slug)) return NextResponse.json({ ok: false, error: "EXAM_NOT_FOUND" }, { status: 404, headers: NO_STORE })
  const rawIp = request.headers.get("x-real-ip")?.trim() || "unknown"
  const ip = /^[0-9a-fA-F:.]{1,64}$/.test(rawIp) ? rawIp : "unknown"
  const rate = await checkDurableRateLimit(`research-exam:${slug}:${ip}`, 20, 60 * 60_000, { onUnavailable: "deny" })
  if (!rate.ok) return NextResponse.json({ ok: false, error: durableRateLimitCode(rate) }, { status: durableRateLimitStatus(rate), headers: NO_STORE })
  const parsed = await readBoundedJson(request, 32 * 1024)
  if (!parsed.ok) return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400, headers: NO_STORE })
  if (!getServiceSupabaseConfig()) return NextResponse.json({ ok: false, error: "RESEARCH_STORAGE_UNAVAILABLE" }, { status: 503, headers: NO_STORE })
  const body = parsed.value
  const action = typeof body.action === "string" ? body.action : ""
  const respondentKey = typeof body.respondentKey === "string" ? body.respondentKey : ""
  if (!new Set(["start", "save", "submit", "resume", "result"]).has(action) || !/^[A-Za-z0-9_-]{24,128}$/.test(respondentKey)) return NextResponse.json({ ok: false, error: "INVALID_EXAM_REQUEST" }, { status: 400, headers: NO_STORE })
  const keyHash = respondentHash(respondentKey)
  if (!keyHash) return NextResponse.json({ ok: false, error: "EXAM_SECURITY_NOT_CONFIGURED" }, { status: 503, headers: NO_STORE })
  const projectResult = await supabaseRest<Array<Record<string, unknown>>>(`gh_research_projects?slug=eq.${encodeURIComponent(slug)}&status=eq.published&select=id,form_schema,settings&limit=1`)
  if (!projectResult.ok) return NextResponse.json({ ok: false, error: "EXAM_STORAGE_UNAVAILABLE" }, { status: 503, headers: NO_STORE })
  const project = projectResult.data?.[0]
  if (!project) return NextResponse.json({ ok: false, error: "EXAM_NOT_FOUND" }, { status: 404, headers: NO_STORE })
  const settings = asObject(project.settings)
  const config = asObject(settings.exam) as ExamConfig
  if (config.enabled !== true) return NextResponse.json({ ok: false, error: "EXAM_NOT_ENABLED" }, { status: 404, headers: NO_STORE })
  const allQuestions = (asObject(project.form_schema).questions as ExamQuestion[] || []).slice(0, 80)
  const questions = allQuestions
  const scoredQuestions = questions.filter((q) => Object.prototype.hasOwnProperty.call(q, "correctAnswer") || Object.prototype.hasOwnProperty.call(q, "answerKey"))
  if (!questions.length || questions.length > 80 || !scoredQuestions.length || questions.some((q) => !validQuestion(q) || (["single_choice", "dropdown"].includes(q.type) && !Object.prototype.hasOwnProperty.call(q, "correctAnswer") && !Object.prototype.hasOwnProperty.call(q, "answerKey")) || (!["single_choice", "dropdown", "short_text", "long_text"].includes(q.type)) || ((Object.prototype.hasOwnProperty.call(q, "correctAnswer") || Object.prototype.hasOwnProperty.call(q, "answerKey")) && !["single_choice", "dropdown"].includes(q.type)) || q.showWhen !== undefined)) return NextResponse.json({ ok: false, error: "EXAM_CONFIGURATION_INVALID" }, { status: 503, headers: NO_STORE })
  const durationSeconds = Number.isInteger(config.durationSeconds) ? Math.max(60, Math.min(4 * 60 * 60, Number(config.durationSeconds))) : 1800
  const maxAttempts = Number.isInteger(config.maxAttempts) ? Math.max(1, Math.min(10, Number(config.maxAttempts))) : 1
  const attemptQuery = `gh_research_exam_attempts?project_id=eq.${encodeURIComponent(String(project.id))}&respondent_key_hash=eq.${keyHash}&select=id,attempt_number,question_order,started_at,deadline_at,submitted_at,status,answers,score,max_score,result_status&order=attempt_number.desc&limit=10`
  const existing = await supabaseRest<Array<Record<string, unknown>>>(attemptQuery)
  if (!existing.ok) return NextResponse.json({ ok: false, error: "EXAM_ATTEMPTS_UNAVAILABLE" }, { status: 503, headers: NO_STORE })
  let attempt = existing.data?.find((row) => row.status === "in_progress")
  if (attempt && Date.now() >= Date.parse(String(attempt.deadline_at))) {
    await supabaseRest(`gh_research_exam_attempts?id=eq.${encodeURIComponent(String(attempt.id))}&status=eq.in_progress`, { method: "PATCH", headers: { "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ status: "timed_out", submitted_at: new Date().toISOString() }) })
    attempt = undefined
  }
  if (action === "result") {
    const resultAttemptId = typeof body.attemptId === "string" ? body.attemptId : ""
    if (!/^[0-9a-f-]{36}$/i.test(resultAttemptId)) return NextResponse.json({ ok: false, error: "INVALID_ATTEMPT_ID" }, { status: 400, headers: NO_STORE })
    const released = await supabaseRest<Array<{ id: string; status: string; score: number|null; max_score: number|null }>>(`gh_research_exam_attempts?id=eq.${encodeURIComponent(resultAttemptId)}&project_id=eq.${encodeURIComponent(String(project.id))}&respondent_key_hash=eq.${keyHash}&result_status=eq.released&select=id,status,score,max_score&limit=1`)
    if (!released.ok) return NextResponse.json({ ok: false, error: "EXAM_RESULT_UNAVAILABLE" }, { status: 503, headers: NO_STORE })
    const row = released.data?.[0]
    if (!row || !["submitted", "reviewed"].includes(row.status) || row.score === null || row.max_score === null || Number(row.max_score) <= 0) return NextResponse.json({ ok: true, available: false }, { headers: NO_STORE })
    const score = Number(row.score)
    const maxScore = Number(row.max_score)
    const percentage = Math.max(0, Math.min(100, score / maxScore * 100))
    const passPercentage = Number.isFinite(config.passPercentage) ? Math.max(0, Math.min(100, Number(config.passPercentage))) : 50
    return NextResponse.json({ ok: true, available: true, result: { score, maxScore, percentage: Number(percentage.toFixed(2)), passed: percentage >= passPercentage } }, { headers: NO_STORE })
  }
  if (action === "start" || action === "resume") {
    if (!attempt) {
      if (action === "resume") return NextResponse.json({ ok: false, error: "NO_ACTIVE_ATTEMPT" }, { status: 404, headers: NO_STORE })
      const used = existing.data?.length || 0
      if (used >= maxAttempts) return NextResponse.json({ ok: false, error: "ATTEMPT_LIMIT_REACHED" }, { status: 409, headers: NO_STORE })
      const ordered = config.shuffleQuestions === false ? [...questions] : shuffle(questions)
      const questionOrder = ordered.map((q) => ({ id: q.id, optionOrder: ["single_choice", "dropdown"].includes(q.type) ? (config.shuffleChoices === false ? (q.options || []).map((_, index) => index) : shuffle((q.options || []).map((_, index) => index))) : [] }))
      const now = Date.now()
      const created = await supabaseRest<Array<Record<string, unknown>>>("gh_research_exam_attempts?select=id,attempt_number,question_order,started_at,deadline_at,status,answers,result_status", { method: "POST", headers: { "Content-Type": "application/json", Prefer: "return=representation" }, body: JSON.stringify({ project_id: project.id, respondent_key_hash: keyHash, attempt_number: used + 1, question_order: questionOrder, started_at: new Date(now).toISOString(), deadline_at: new Date(now + durationSeconds * 1000).toISOString(), status: "in_progress", answers: {} }) })
      if (!created.ok || !created.data?.[0]) return NextResponse.json({ ok: false, error: "EXAM_START_FAILED" }, { status: 503, headers: NO_STORE })
      attempt = created.data[0]
    }
    const order = Array.isArray(attempt.question_order) ? attempt.question_order as Array<{ id: string; optionOrder?: number[] }> : []
    const visible = order.map((item) => { const q = questions.find((candidate) => candidate.id === item.id); const indexes = Array.isArray(item.optionOrder) ? item.optionOrder : (q?.options || []).map((_, index) => index); const displayOptions = q && ["single_choice", "dropdown"].includes(q.type) ? indexes.map((index) => q.options?.[index]).filter((value): value is string => typeof value === "string") : []; return q ? { ...cleanQuestion(q), displayOptions } : null }).filter(Boolean)
    return NextResponse.json({ ok: true, attempt: { id: attempt.id, attemptNumber: attempt.attempt_number, startedAt: attempt.started_at, deadlineAt: attempt.deadline_at, status: attempt.status, answers: attempt.answers || {}, questions: visible } }, { headers: NO_STORE })
  }
  const attemptId = typeof body.attemptId === "string" ? body.attemptId : ""
  if (!/^[0-9a-f-]{36}$/i.test(attemptId) || !attempt || attempt.id !== attemptId) return NextResponse.json({ ok: false, error: "ACTIVE_ATTEMPT_NOT_FOUND" }, { status: 404, headers: NO_STORE })
  const answersInput = asObject(body.answers)
  const answers: Record<string, string> = { ...(asObject(attempt.answers) as Record<string, string>) }
  const allowedIds = new Set(questions.map((q) => q.id))
  for (const [questionId, value] of Object.entries(answersInput)) {
    const q = questions.find((candidate) => candidate.id === questionId)
    if (!q || !allowedIds.has(questionId)) return NextResponse.json({ ok: false, error: "UNKNOWN_QUESTION" }, { status: 400, headers: NO_STORE })
    const normalized = normalizeAnswer(value, q)
    if (normalized === null) return NextResponse.json({ ok: false, error: "INVALID_ANSWER", questionId }, { status: 400, headers: NO_STORE })
    answers[questionId] = normalized
  }
  if (action === "save") {
    const saved = await supabaseRest<Array<{ id: string; answers: Record<string, string> }>>(`gh_research_exam_attempts?id=eq.${encodeURIComponent(attemptId)}&project_id=eq.${encodeURIComponent(String(project.id))}&respondent_key_hash=eq.${keyHash}&status=eq.in_progress&select=id,answers`, { method: "PATCH", headers: { "Content-Type": "application/json", Prefer: "return=representation" }, body: JSON.stringify({ answers }) })
    if (!saved.ok) return NextResponse.json({ ok: false, error: "EXAM_AUTOSAVE_FAILED" }, { status: 503, headers: NO_STORE })
    if (!saved.data?.[0]) return NextResponse.json({ ok: false, error: "ATTEMPT_NOT_ACTIVE" }, { status: 409, headers: NO_STORE })
    return NextResponse.json({ ok: true, savedAt: new Date().toISOString() }, { headers: NO_STORE })
  }
  if (action === "submit") {
    for (const q of questions) if (q.required !== false && (!(q.id in answers) || !String(answers[q.id] ?? "").trim())) return NextResponse.json({ ok: false, error: "ANSWERS_INCOMPLETE", questionId: q.id }, { status: 400, headers: NO_STORE })
    let score = 0
    let maxScore = 0
    for (const q of questions) {
      const correct = q.correctAnswer ?? q.answerKey
      if (correct === undefined) continue
      const points = Number.isFinite(q.points) && Number(q.points) > 0 && Number(q.points) <= 100 ? Number(q.points) : 1
      maxScore += points
      if (answers[q.id] === correct) score += points
    }
    const percentage = maxScore > 0 ? score / maxScore * 100 : 0
    const passPercentage = Number.isFinite(config.passPercentage) ? Math.max(0, Math.min(100, Number(config.passPercentage))) : 50
    const release = config.resultRelease === "immediate"
    const updated = await supabaseRest<Array<Record<string, unknown>>>(`gh_research_exam_attempts?id=eq.${encodeURIComponent(attemptId)}&project_id=eq.${encodeURIComponent(String(project.id))}&respondent_key_hash=eq.${keyHash}&status=eq.in_progress&select=id,status,submitted_at,result_status,score,max_score`, { method: "PATCH", headers: { "Content-Type": "application/json", Prefer: "return=representation" }, body: JSON.stringify({ answers, score: Number(score.toFixed(2)), max_score: Number(maxScore.toFixed(2)), status: "submitted", submitted_at: new Date().toISOString(), result_status: release ? "released" : "withheld" }) })
    if (!updated.ok) return NextResponse.json({ ok: false, error: "EXAM_SUBMIT_FAILED" }, { status: 503, headers: NO_STORE })
    if (!updated.data?.[0]) return NextResponse.json({ ok: false, error: "ATTEMPT_NOT_ACTIVE" }, { status: 409, headers: NO_STORE })
    return NextResponse.json({ ok: true, submitted: true, result: release ? { score, maxScore, percentage: Number(percentage.toFixed(2)), passed: percentage >= passPercentage } : null, resultStatus: release ? "released" : "withheld" }, { headers: NO_STORE })
  }
  return NextResponse.json({ ok: false, error: "INVALID_EXAM_ACTION" }, { status: 400, headers: NO_STORE })
}
