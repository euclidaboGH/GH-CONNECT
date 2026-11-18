import { NextResponse } from "next/server"
import { randomBytes, randomUUID } from "node:crypto"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { supabaseRest, getServiceSupabaseConfig } from "@/lib/server/supabase/rest-client"
import { checkDurableRateLimit, durableRateLimitCode, durableRateLimitStatus } from "@/lib/server/security/control-plane"
import { readBoundedJson } from "@/lib/server/http/read-bounded-json"
import { validateResearchLogic, type ResearchQuestion } from "@/lib/research/logic"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "private, no-store", Vary: "Cookie, Authorization" }
const SAFE_ID = /^[a-zA-Z0-9_-]{1,256}$/
const TYPES = new Set(["survey", "examination", "election_observation", "registration", "custom"])
const QUESTION_TYPES = new Set(["short_text", "long_text", "single_choice", "multiple_choice", "dropdown", "rating", "number", "date"])

type Question = ResearchQuestion & { required: boolean; helpText?: string; correctAnswer?: string; points?: number }
function cleanQuestions(input: unknown, allowAnswerKey: boolean): Question[] | null {
  if (!Array.isArray(input) || input.length < 1 || input.length > 80) return null
  const out: Question[] = []
  const seenIds = new Set<string>()
  for (const raw of input) {
    if (!raw || typeof raw !== "object") return null
    const q = raw as Record<string, unknown>
    const type = String(q.type || "")
    const label = String(q.label || "").trim()
    if (!QUESTION_TYPES.has(type) || !label || label.length > 240) return null
    const id = /^[a-zA-Z0-9_-]{1,48}$/.test(String(q.id || "")) && !seenIds.has(String(q.id)) ? String(q.id) : randomUUID().replace(/-/g, "").slice(0, 16)
    if (seenIds.has(id)) return null
    seenIds.add(id)
    const options = Array.isArray(q.options) ? q.options.map((v) => String(v).trim().slice(0, 120)).filter(Boolean).slice(0, 30) : undefined
    if (["single_choice", "multiple_choice", "dropdown"].includes(type) && (!options || options.length < 2)) return null
    if (allowAnswerKey && q.showWhen !== undefined) return null
    const hasAnswerKey = Object.prototype.hasOwnProperty.call(q, "correctAnswer")
    const scoredType = ["single_choice", "dropdown"].includes(type)
    if (hasAnswerKey && (!allowAnswerKey || !scoredType || !options || !options.includes(String(q.correctAnswer)))) return null
    if (allowAnswerKey && scoredType && !hasAnswerKey) return null
    if (allowAnswerKey && !scoredType && !["short_text", "long_text"].includes(type)) return null
    const points = q.points === undefined ? 1 : Number(q.points)
    if (allowAnswerKey && (!Number.isInteger(points) || points < 1 || points > 100)) return null
    out.push({ id, type, label, required: q.required === true, ...(options ? { options } : {}), ...(q.helpText ? { helpText: String(q.helpText).slice(0, 240) } : {}), ...(q.showWhen && typeof q.showWhen === "object" ? { showWhen: q.showWhen as Question["showWhen"] } : {}), ...(allowAnswerKey && hasAnswerKey ? { correctAnswer: String(q.correctAnswer), points } : {}) } as Question)
  }
  const logic = validateResearchLogic(out)
  if (!logic.ok) return null
  return out
}

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth || !SAFE_ID.test(auth.userId)) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: NO_STORE })
  const rate = await checkDurableRateLimit(`research-project-list:${auth.userId}`, 60, 60_000, { onUnavailable: "deny" })
  if (!rate.ok) return NextResponse.json({ ok: false, error: durableRateLimitCode(rate) }, { status: durableRateLimitStatus(rate), headers: NO_STORE })
  if (!getServiceSupabaseConfig()) return NextResponse.json({ ok: false, error: "RESEARCH_STORAGE_UNAVAILABLE" }, { status: 503, headers: NO_STORE })
  const result = await supabaseRest<Array<Record<string, unknown>>>(`gh_research_projects?owner_user_id=eq.${encodeURIComponent(auth.userId)}&select=id,slug,title,description,project_type,status,form_schema,created_at,updated_at,published_at&order=updated_at.desc&limit=100`)
  if (!result.ok) return NextResponse.json({ ok: false, error: "RESEARCH_STORAGE_UNAVAILABLE" }, { status: 503, headers: NO_STORE })
  return NextResponse.json({ ok: true, projects: result.data }, { headers: NO_STORE })
}

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth || !SAFE_ID.test(auth.userId)) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: NO_STORE })
  const rate = await checkDurableRateLimit(`research-project-create:${auth.userId}`, 12, 60 * 60_000, { onUnavailable: "deny" })
  if (!rate.ok) return NextResponse.json({ ok: false, error: durableRateLimitCode(rate) }, { status: durableRateLimitStatus(rate), headers: NO_STORE })
  const parsed = await readBoundedJson(request, 32 * 1024)
  if (!parsed.ok) return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: parsed.error === "REQUEST_TOO_LARGE" ? 413 : 400, headers: NO_STORE })
  const value = parsed.value as Record<string, unknown>
  const title = typeof value.title === "string" ? value.title.trim().slice(0, 140) : ""
  const description = typeof value.description === "string" ? value.description.trim().slice(0, 1200) : ""
  const projectType = String(value.projectType || "custom")
  const questions = cleanQuestions(value.questions, projectType === "examination")
  const examInput = value.examConfig && typeof value.examConfig === "object" && !Array.isArray(value.examConfig) ? value.examConfig as Record<string, unknown> : {}
  const durationSeconds = Number(examInput.durationSeconds ?? 1800)
  const maxAttempts = Number(examInput.maxAttempts ?? 1)
  const passPercentage = Number(examInput.passPercentage ?? 50)
  if (projectType === "examination" && (!Number.isInteger(durationSeconds) || durationSeconds < 60 || durationSeconds > 14400 || !Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 10 || !Number.isFinite(passPercentage) || passPercentage < 0 || passPercentage > 100)) return NextResponse.json({ ok: false, error: "INVALID_EXAM_SETTINGS" }, { status: 400, headers: NO_STORE })
  if (!title || !TYPES.has(projectType) || !questions) return NextResponse.json({ ok: false, error: "INVALID_RESEARCH_DEFINITION" }, { status: 400, headers: NO_STORE })
  if (projectType === "examination" && !questions.some((question) => Object.prototype.hasOwnProperty.call(question, "correctAnswer"))) return NextResponse.json({ ok: false, error: "EXAM_REQUIRES_SCORED_QUESTIONS" }, { status: 400, headers: NO_STORE })
  if (!getServiceSupabaseConfig()) return NextResponse.json({ ok: false, error: "RESEARCH_STORAGE_UNAVAILABLE" }, { status: 503, headers: NO_STORE })
  const id = randomUUID()
  const slug = randomBytes(18).toString("base64url")
  const now = new Date().toISOString()
  const row = { id, owner_user_id: auth.userId, slug, title, description, project_type: projectType, status: "draft", form_schema: { version: 1, questions }, settings: { allow_anonymous: true, allow_evidence_uploads: true, response_limit: null, ...(projectType === "examination" ? { exam: { enabled: true, durationSeconds, maxAttempts, passPercentage, shuffleQuestions: examInput.shuffleQuestions !== false, shuffleChoices: examInput.shuffleChoices !== false, resultRelease: examInput.resultRelease === "immediate" ? "immediate" : "manual" } } : {}) }, created_at: now, updated_at: now }
  const saved = await supabaseRest<Array<Record<string, unknown>>>("gh_research_projects?select=id,slug,title,description,project_type,status,form_schema,created_at,updated_at", { method: "POST", headers: { "Content-Type": "application/json", Prefer: "return=representation" }, body: JSON.stringify(row), timeoutMs: 10_000 })
  if (!saved.ok || !saved.data?.[0]) return NextResponse.json({ ok: false, error: "RESEARCH_CREATE_FAILED" }, { status: 503, headers: NO_STORE })
  return NextResponse.json({ ok: true, project: saved.data[0] }, { status: 201, headers: NO_STORE })
}
