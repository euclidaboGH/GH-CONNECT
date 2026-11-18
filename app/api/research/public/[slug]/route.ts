import { NextResponse } from "next/server"
import { randomUUID } from "node:crypto"
import { supabaseRest, getServiceSupabaseConfig } from "@/lib/server/supabase/rest-client"
import { readBoundedJson } from "@/lib/server/http/read-bounded-json"
import { checkDurableRateLimit, durableRateLimitCode, durableRateLimitStatus } from "@/lib/server/security/control-plane"
import { isResearchQuestionVisible, type ResearchQuestion } from "@/lib/research/logic"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }
type Question = ResearchQuestion

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(slug) || !getServiceSupabaseConfig()) return NextResponse.json({ ok: false, error: "RESEARCH_NOT_FOUND" }, { status: 404, headers: NO_STORE })
  const result = await supabaseRest<Array<Record<string, unknown>>>(`gh_research_projects?slug=eq.${encodeURIComponent(slug)}&status=eq.published&select=id,slug,title,description,project_type,form_schema,settings&limit=1`)
  const project = result.ok ? result.data?.[0] : null
  if (!project) return NextResponse.json({ ok: false, error: "RESEARCH_NOT_FOUND" }, { status: 404, headers: NO_STORE })
  return NextResponse.json({ ok: true, project: { slug: project.slug, title: project.title, description: project.description, projectType: project.project_type, isExam: project.project_type === "examination", questions: ((project.form_schema as { questions?: Question[] })?.questions || []).map((question) => { const { correctAnswer: _correctAnswer, answerKey: _answerKey, points: _points, ...publicQuestion } = question as Question & { correctAnswer?: unknown; answerKey?: unknown; points?: unknown }; return publicQuestion }), allowEvidenceUploads: project.project_type !== "examination" && (project.settings as Record<string, unknown>)?.allow_evidence_uploads !== false } }, { headers: NO_STORE })
}

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(slug)) return NextResponse.json({ ok: false, error: "RESEARCH_NOT_FOUND" }, { status: 404, headers: NO_STORE })
  const rawIp = request.headers.get("x-real-ip")?.trim() || "unknown"
  const ip = /^[0-9a-fA-F:.]{1,64}$/.test(rawIp) ? rawIp : "unknown"
  const rate = await checkDurableRateLimit(`research-public-submit:${slug}:${ip}`, 8, 60 * 60_000, { onUnavailable: "deny" })
  if (!rate.ok) return NextResponse.json({ ok: false, error: durableRateLimitCode(rate) }, { status: durableRateLimitStatus(rate), headers: NO_STORE })
  const parsed = await readBoundedJson(request, 64 * 1024)
  if (!parsed.ok) return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: parsed.error === "REQUEST_TOO_LARGE" ? 413 : 400, headers: NO_STORE })
  const payload = parsed.value as Record<string, unknown>
  const answers = payload.answers && typeof payload.answers === "object" && !Array.isArray(payload.answers) ? payload.answers as Record<string, unknown> : null
  const consent = payload.consent === true
  if (!answers || !consent) return NextResponse.json({ ok: false, error: "CONSENT_AND_ANSWERS_REQUIRED" }, { status: 400, headers: NO_STORE })
  if (!getServiceSupabaseConfig()) return NextResponse.json({ ok: false, error: "RESEARCH_STORAGE_UNAVAILABLE" }, { status: 503, headers: NO_STORE })
  const projectResult = await supabaseRest<Array<Record<string, unknown>>>(`gh_research_projects?slug=eq.${encodeURIComponent(slug)}&status=eq.published&select=id,project_type,form_schema,settings&limit=1`)
  const project = projectResult.ok ? projectResult.data?.[0] : null
  if (!project) return NextResponse.json({ ok: false, error: "RESEARCH_NOT_FOUND" }, { status: 404, headers: NO_STORE })
  if (project.project_type === "examination") return NextResponse.json({ ok: false, error: "EXAM_SUBMISSION_REQUIRED" }, { status: 409, headers: NO_STORE })
  const questions = ((project.form_schema as { questions?: Question[] })?.questions || []).slice(0, 80)
  const normalized: Record<string, string | string[] | number> = {}
  for (const q of questions) {
    const visible = isResearchQuestionVisible(q.showWhen, normalized)
    if (!visible) continue
    const raw = answers[q.id]
    const empty = raw === undefined || raw === null || raw === "" || (typeof raw === "string" && !raw.trim()) || (Array.isArray(raw) && raw.length === 0)
    if (q.required && empty) return NextResponse.json({ ok: false, error: "REQUIRED_ANSWER_MISSING", questionId: q.id }, { status: 400, headers: NO_STORE })
    if (raw === undefined || raw === null || raw === "") continue
    if (["single_choice", "dropdown"].includes(q.type)) {
      if (typeof raw !== "string" || !(q.options || []).includes(raw)) return NextResponse.json({ ok: false, error: "INVALID_ANSWER", questionId: q.id }, { status: 400, headers: NO_STORE })
      normalized[q.id] = raw
    } else if (q.type === "multiple_choice") {
      if (!Array.isArray(raw) || raw.length > 30 || raw.some((v) => typeof v !== "string" || !(q.options || []).includes(v))) return NextResponse.json({ ok: false, error: "INVALID_ANSWER", questionId: q.id }, { status: 400, headers: NO_STORE })
      normalized[q.id] = raw as string[]
    } else if (q.type === "rating" || q.type === "number") {
      const n = Number(raw)
      const max = q.type === "rating" ? 5 : 1000000
      if (!Number.isFinite(n) || n < 0 || n > max || (q.type === "rating" && !Number.isInteger(n))) return NextResponse.json({ ok: false, error: "INVALID_ANSWER", questionId: q.id }, { status: 400, headers: NO_STORE })
      normalized[q.id] = n
    } else {
      if (typeof raw !== "string" || raw.length > 4000) return NextResponse.json({ ok: false, error: "INVALID_ANSWER", questionId: q.id }, { status: 400, headers: NO_STORE })
      if (q.type === "date" && (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(Date.parse(`${raw}T00:00:00Z`)))) return NextResponse.json({ ok: false, error: "INVALID_ANSWER", questionId: q.id }, { status: 400, headers: NO_STORE })
      normalized[q.id] = raw.trim()
    }
  }
  const acceptedIds = new Set(questions.filter((q) => isResearchQuestionVisible(q.showWhen, normalized)).map((q) => q.id))
  if (Object.keys(answers).some((key) => !acceptedIds.has(key))) return NextResponse.json({ ok: false, error: "UNKNOWN_OR_HIDDEN_ANSWER" }, { status: 400, headers: NO_STORE })
  const idempotencyKey = typeof payload.submissionKey === "string" && /^[A-Za-z0-9_-]{16,80}$/.test(payload.submissionKey) ? payload.submissionKey : randomUUID()
  const saved = await supabaseRest<Array<Record<string, unknown>>>("gh_research_responses?on_conflict=project_id,submission_key&select=id,submitted_at", { method: "POST", headers: { "Content-Type": "application/json", Prefer: "return=representation,resolution=ignore-duplicates" }, body: JSON.stringify({ id: randomUUID(), project_id: project.id, submission_key: idempotencyKey, answers: normalized, consent_recorded_at: new Date().toISOString(), review_status: "received" }), timeoutMs: 12_000 })
  if (!saved.ok) return NextResponse.json({ ok: false, error: "RESPONSE_SAVE_FAILED" }, { status: 503, headers: NO_STORE })
  const fallbackResponse = saved.data?.[0] ? null : await supabaseRest<Array<{ id: string }>>(`gh_research_responses?project_id=eq.${project.id}&submission_key=eq.${encodeURIComponent(idempotencyKey)}&select=id&limit=1`)
  const responseRow = saved.data?.[0] || (fallbackResponse?.ok ? fallbackResponse.data[0] : undefined)
  if (!responseRow?.id) return NextResponse.json({ ok: false, error: "RESPONSE_REFERENCE_UNAVAILABLE" }, { status: 503, headers: NO_STORE })
  // Bind only uploads created under this exact project + unguessable submission key.
  const pendingEvidence = await supabaseRest<Array<{ id: string }>>(`gh_research_evidence?project_id=eq.${project.id}&submission_key=eq.${encodeURIComponent(idempotencyKey)}&response_id=is.null&select=id&limit=6`)
  if (!pendingEvidence.ok) return NextResponse.json({ ok: false, error: "RESPONSE_EVIDENCE_RECONCILIATION_PENDING" }, { status: 503, headers: NO_STORE })
  if (pendingEvidence.data.length) {
    const attached = await supabaseRest(`gh_research_evidence?project_id=eq.${project.id}&submission_key=eq.${encodeURIComponent(idempotencyKey)}&response_id=is.null`, { method: "PATCH", headers: { "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ response_id: responseRow.id }) })
    if (!attached.ok) return NextResponse.json({ ok: false, error: "RESPONSE_EVIDENCE_RECONCILIATION_PENDING" }, { status: 503, headers: NO_STORE })
  }
  const attachedEvidence = await supabaseRest<Array<{ id: string }>>(`gh_research_evidence?project_id=eq.${project.id}&response_id=eq.${responseRow.id}&select=id&limit=6`)
  if (!attachedEvidence.ok) return NextResponse.json({ ok: false, error: "RESPONSE_EVIDENCE_RECONCILIATION_PENDING" }, { status: 503, headers: NO_STORE })
  return NextResponse.json({ ok: true, message: "Your response has been received.", duplicate: !saved.data?.length, evidenceCount: attachedEvidence.data.length }, { status: 201, headers: NO_STORE })
}
