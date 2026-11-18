import { NextResponse } from "next/server"
import { readBoundedJson } from "@/lib/server/http/read-bounded-json"
import { checkDurableRateLimit, durableRateLimitCode, durableRateLimitStatus } from "@/lib/server/security/control-plane"
import { supabaseRest } from "@/lib/server/supabase/rest-client"
import { createScopedEvidenceUpload } from "@/lib/server/evidence/scoped-upload"
export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const noStore = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" }
export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params
  const parsed = await readBoundedJson(request, 8 * 1024)
  if (!parsed.ok) return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400, headers: noStore })
  const body = parsed.value as Record<string, unknown>
  const submissionKey = String(body.submissionKey || "")
  if (!/^[A-Za-z0-9_-]{16,80}$/.test(submissionKey) || !/^[A-Za-z0-9_-]{20,64}$/.test(slug)) return NextResponse.json({ ok: false, error: "INVALID_UPLOAD_SCOPE" }, { status: 400, headers: noStore })
  const rawIp = request.headers.get("x-real-ip")?.trim() || "unknown"
  const ip = /^[0-9a-fA-F:.]{1,64}$/.test(rawIp) ? rawIp : "unknown"
  const rate = await checkDurableRateLimit(`research-public-evidence:${slug}:${ip}`, 10, 60 * 60_000, { onUnavailable: "deny" })
  if (!rate.ok) return NextResponse.json({ ok: false, error: durableRateLimitCode(rate) }, { status: durableRateLimitStatus(rate), headers: noStore })
  const project = await supabaseRest<Array<Record<string, unknown>>>(`gh_research_projects?slug=eq.${encodeURIComponent(slug)}&status=eq.published&select=id,project_type,settings&limit=1`)
  const row = project.ok ? project.data[0] : null
  if (!row || (row.settings as Record<string, unknown>)?.allow_evidence_uploads === false) return NextResponse.json({ ok: false, error: "EVIDENCE_UPLOADS_DISABLED" }, { status: 404, headers: noStore })
  const result = await createScopedEvidenceUpload({ scopeType: "research_response", projectId: String(row.id), submissionKey, mimeType: String(body.mimeType || ""), byteSize: Number(body.byteSize), fileName: String(body.fileName || "evidence"), uploaderLabel: "Public respondent", geoUnitId: typeof body.geoUnitId === "string" ? body.geoUnitId : null, requirePollingUnit: row.project_type === "election_observation" })
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: result.status, headers: noStore })
  return NextResponse.json({ ...result }, { status: 201, headers: noStore })
}
