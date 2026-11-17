import { NextResponse } from "next/server"
import { readBoundedJson } from "@/lib/server/http/read-bounded-json"
import { checkDurableRateLimit, durableRateLimitCode, durableRateLimitStatus } from "@/lib/server/security/control-plane"
import { supabaseRest } from "@/lib/server/supabase/rest-client"
import { finalizeScopedEvidenceUpload } from "@/lib/server/evidence/scoped-upload"
export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const noStore = { "Cache-Control": "no-store" }
export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params
  const parsed = await readBoundedJson(request, 8 * 1024)
  if (!parsed.ok) return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400, headers: noStore })
  const body = parsed.value as Record<string, unknown>
  const uploadId = String(body.uploadId || "")
  const token = String(body.token || "")
  if (!/^[0-9a-f-]{36}$/i.test(uploadId) || token.length < 40 || token.length > 100) return NextResponse.json({ ok: false, error: "INVALID_UPLOAD_TOKEN" }, { status: 400, headers: noStore })
  const project = await supabaseRest<Array<{ id: string; settings: Record<string, unknown> }>>(`gh_research_projects?slug=eq.${encodeURIComponent(slug)}&status=eq.published&select=id,settings&limit=1`)
  const row = project.ok ? project.data[0] : null
  if (!row || row.settings?.allow_evidence_uploads === false) return NextResponse.json({ ok: false, error: "RESEARCH_NOT_FOUND" }, { status: 404, headers: noStore })
  const rate = await checkDurableRateLimit(`research-evidence-complete:${slug}:${uploadId}`, 5, 60 * 60_000, { onUnavailable: "deny" })
  if (!rate.ok) return NextResponse.json({ ok: false, error: durableRateLimitCode(rate) }, { status: durableRateLimitStatus(rate), headers: noStore })
  const result = await finalizeScopedEvidenceUpload({ uploadId, token, expectedScope: "research_response", scopeId: row.id })
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: result.status, headers: noStore })
  return NextResponse.json({ ...result }, { status: 201, headers: noStore })
}
