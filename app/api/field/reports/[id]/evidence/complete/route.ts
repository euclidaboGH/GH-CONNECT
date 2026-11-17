import { NextResponse } from "next/server"
import { readBoundedJson } from "@/lib/server/http/read-bounded-json"
import { fieldTokenFromRequest } from "@/lib/server/field/access"
import { checkDurableRateLimit, durableRateLimitCode, durableRateLimitStatus } from "@/lib/server/security/control-plane"
import { finalizeScopedEvidenceUpload } from "@/lib/server/evidence/scoped-upload"
export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const noStore = { "Cache-Control": "no-store" }
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = fieldTokenFromRequest(request)
  if (!session) return NextResponse.json({ ok: false, error: "FIELD_AUTH_REQUIRED" }, { status: 401, headers: noStore })
  const { id } = await context.params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ ok: false, error: "REPORT_NOT_FOUND" }, { status: 404, headers: noStore })
  const rate = await checkDurableRateLimit(`field-evidence-complete:${session.jti}`, 15, 60 * 60_000, { onUnavailable: "deny" })
  if (!rate.ok) return NextResponse.json({ ok: false, error: durableRateLimitCode(rate) }, { status: durableRateLimitStatus(rate), headers: noStore })
  const parsed = await readBoundedJson(request, 8 * 1024)
  if (!parsed.ok) return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400, headers: noStore })
  const body = parsed.value as Record<string, unknown>
  const uploadId = String(body.uploadId || "")
  const token = String(body.token || "")
  if (!/^[0-9a-f-]{36}$/i.test(uploadId) || token.length < 40 || token.length > 100) return NextResponse.json({ ok: false, error: "INVALID_UPLOAD_TOKEN" }, { status: 400, headers: noStore })
  const result = await finalizeScopedEvidenceUpload({ uploadId, token, expectedScope: "field_report", scopeId: id, sessionJti: session.jti })
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: result.status, headers: noStore })
  return NextResponse.json({ ...result }, { status: 201, headers: noStore })
}
