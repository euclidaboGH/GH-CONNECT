/**
 * Field Desk durable intake — text reports and survey responses.
 * Prefer Supabase when configured; otherwise process-local ring buffer (Preview/dev only).
 */
import { randomUUID } from "node:crypto"
import { supabaseRpc, supabaseRest, getServiceSupabaseConfig } from "@/lib/server/supabase/rest-client"

export type FieldReportKind = "situation" | "result" | "survey" | "general"

export type FieldReport = {
  id: string
  kind: FieldReportKind
  body: string
  label?: string
  locationHint?: string
  surveyId?: string
  createdAt: string
  channel: "field_desk"
  fieldSessionJti?: string
}

const memoryReports: FieldReport[] = []
const MEMORY_CAP = 500

function pushMemory(report: FieldReport) {
  memoryReports.unshift(report)
  if (memoryReports.length > MEMORY_CAP) memoryReports.length = MEMORY_CAP
}

export function adminInboxUserId(): string | null {
  const id = String(process.env.GHC_FIELD_ADMIN_USER_ID || "").trim()
  return id && id.length <= 128 ? id : null
}

export async function persistFieldReport(input: {
  kind: FieldReportKind
  body: string
  label?: string
  locationHint?: string
  surveyId?: string
  fieldSessionJti?: string
}): Promise<{ ok: true; report: FieldReport } | { ok: false; error: string }> {
  const body = String(input.body || "").trim()
  if (body.length < 1 || body.length > 4000) {
    return { ok: false, error: "INVALID_BODY" }
  }
  const kind = input.kind
  if (!["situation", "result", "survey", "general"].includes(kind)) {
    return { ok: false, error: "INVALID_KIND" }
  }

  const report: FieldReport = {
    id: randomUUID(),
    kind,
    body,
    label: input.label?.slice(0, 40),
    locationHint: input.locationHint?.replace(/[^\w\s\-.,/]/g, "").trim().slice(0, 80) || undefined,
    surveyId: input.surveyId?.slice(0, 64),
    createdAt: new Date().toISOString(),
    channel: "field_desk",
  }

  const config = getServiceSupabaseConfig()
  if (config) {
    // Best-effort RPC; proposal migration may not be applied yet.
    const scopedRpc = await supabaseRpc<Record<string, unknown>>("gh_field_report_append_scoped", {
      p_id: report.id,
      p_kind: report.kind,
      p_body: report.body,
      p_label: report.label || null,
      p_location_hint: report.locationHint || null,
      p_survey_id: report.surveyId || null,
      p_admin_user_id: adminInboxUserId(),
      p_field_session_jti: input.fieldSessionJti || null,
    }, { timeoutMs: 8_000 })
    if (scopedRpc.ok && scopedRpc.data && (scopedRpc.data as { ok?: boolean }).ok === true) {
      report.fieldSessionJti = input.fieldSessionJti
      return { ok: true, report }
    }
    const rpcMissing = !scopedRpc.ok && (scopedRpc.status === 404 || (scopedRpc.status === 400 && /function|schema cache|not found/i.test(JSON.stringify(scopedRpc.body || ""))))
    if (rpcMissing) {
      // Backward-compatible report intake while the additive scoped-upload migration is held.
      // These legacy rows intentionally have no session JTI and cannot receive direct agent uploads.
      const legacy = await supabaseRpc<Record<string, unknown>>("gh_field_report_append", {
        p_id: report.id, p_kind: report.kind, p_body: report.body, p_label: report.label || null,
        p_location_hint: report.locationHint || null, p_survey_id: report.surveyId || null, p_admin_user_id: adminInboxUserId(),
      }, { timeoutMs: 8_000 })
      if (legacy.ok && legacy.data && (legacy.data as { ok?: boolean }).ok === true) return { ok: true, report }
    }
    // Once durable storage is configured, never acknowledge a process-local write.
    return { ok: false, error: "FIELD_REPORT_PERSIST_FAILED" }
  }

  // A process-local buffer is useful only for local development. In production,
  // a successful HTTP response must always represent durable storage; otherwise
  // a serverless instance restart could silently erase a field report.
  if (process.env.NODE_ENV === "production") {
    return { ok: false, error: "FIELD_REPORT_STORAGE_UNAVAILABLE" }
  }
  pushMemory(report)
  return { ok: true, report }
}

export async function listFieldReports(limit = 50): Promise<FieldReport[]> {
  const config = getServiceSupabaseConfig()
  if (config) {
    const res = await supabaseRest<Array<Record<string, unknown>>>(
      `gh_field_reports?order=created_at.desc&limit=${Math.min(100, Math.max(1, limit))}`,
      { method: "GET", timeoutMs: 8_000 },
    )
    if (res.ok && Array.isArray(res.data)) {
      return res.data.map((row) => ({
        id: String(row.id),
        kind: row.kind as FieldReportKind,
        body: String(row.body || ""),
        label: row.label ? String(row.label) : undefined,
        locationHint: row.location_hint ? String(row.location_hint) : undefined,
        surveyId: row.survey_id ? String(row.survey_id) : undefined,
        createdAt: String(row.created_at || new Date().toISOString()),
        channel: "field_desk" as const,
      }))
    }
    return []
  }
  return memoryReports.slice(0, limit)
}

/** Built-in survey catalog (env JSON optional). */
export type FieldSurvey = {
  id: string
  title: string
  description?: string
  questions: Array<{ id: string; prompt: string; maxLen?: number }>
}

export function listFieldSurveys(): FieldSurvey[] {
  const raw = process.env.GHC_FIELD_SURVEYS_JSON?.trim()
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as FieldSurvey[]
      if (Array.isArray(parsed)) {
        return parsed.slice(0, 20).map((s) => ({
          id: String(s.id).slice(0, 64),
          title: String(s.title).slice(0, 120),
          description: s.description ? String(s.description).slice(0, 400) : undefined,
          questions: (s.questions || []).slice(0, 12).map((q) => ({
            id: String(q.id).slice(0, 64),
            prompt: String(q.prompt).slice(0, 300),
            maxLen: Math.min(1000, Math.max(40, Number(q.maxLen) || 400)),
          })),
        }))
      }
    } catch {
      /* use defaults */
    }
  }
  return [
    {
      id: "election-day-pulse",
      title: "Election day pulse",
      description: "Short situation check for field agents (text only).",
      questions: [
        { id: "location", prompt: "Polling area / ward (no personal data)", maxLen: 120 },
        { id: "turnout", prompt: "Observed turnout / queue length (brief)", maxLen: 300 },
        { id: "incidents", prompt: "Any incidents or delays? (facts only)", maxLen: 500 },
      ],
    },
    {
      id: "community-survey",
      title: "Community feedback",
      description: "General civic survey — answers are text-only.",
      questions: [
        { id: "priority", prompt: "Top community priority this week?", maxLen: 400 },
        { id: "note", prompt: "Anything else admins should know?", maxLen: 500 },
      ],
    },
  ]
}
