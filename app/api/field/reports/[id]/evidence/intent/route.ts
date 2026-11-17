import { NextResponse } from "next/server"
import { readBoundedJson } from "@/lib/server/http/read-bounded-json"
import { checkDurableRateLimit, durableRateLimitCode, durableRateLimitStatus } from "@/lib/server/security/control-plane"
import { fieldTokenFromRequest } from "@/lib/server/field/access"
import { supabaseRest } from "@/lib/server/supabase/rest-client"
import { createScopedEvidenceUpload } from "@/lib/server/evidence/scoped-upload"
export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const noStore = { "Cache-Control": "no-store" }
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = fieldTokenFromRequest(request)
  if (!session) return NextResponse.json({ ok: false, error: "FIELD_AUTH_REQUIRED" }, { status: 401, headers: noStore })
  const { id } = await context.params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ ok: false, error: "REPORT_NOT_FOUND" }, { status: 404, headers: noStore })
  const rate = await checkDurableRateLimit(`field-evidence-intent:${session.jti}`, 10, 60 * 60_000, { onUnavailable: "deny" })
  if (!rate.ok) return NextResponse.json({ ok: false, error: durableRateLimitCode(rate) }, { status: durableRateLimitStatus(rate), headers: noStore })
  const parsed = await readBoundedJson(request, 8 * 1024)
  if (!parsed.ok) return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400, headers: noStore })
  const body = parsed.value as Record<string, unknown>
  const report = await supabaseRest<Array<{ id: string }>>(`gh_field_reports?id=eq.${id}&field_session_jti=eq.${encodeURIComponent(session.jti)}&select=id&limit=1`)
  if (!report.ok || !report.data.length) return NextResponse.json({ ok: false, error: "REPORT_NOT_FOUND_OR_NOT_OWNED" }, { status: 404, headers: noStore })
  const result = await createScopedEvidenceUpload({ scopeType: "field_report", reportId: id, fieldSessionJti: session.jti, uploaderLabel: session.label || "Field agent", mimeType: String(body.mimeType || ""), byteSize: Number(body.byteSize), fileName: String(body.fileName || "evidence"), geoUnitId: typeof body.geoUnitId === "string" ? body.geoUnitId : null })
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: result.status, headers: noStore })
  return NextResponse.json({ ...result }, { status: 201, headers: noStore })
}
