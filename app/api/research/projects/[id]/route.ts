import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { supabaseRest, getServiceSupabaseConfig } from "@/lib/server/supabase/rest-client"
import { readBoundedJson } from "@/lib/server/http/read-bounded-json"
import { checkDurableRateLimit, durableRateLimitCode, durableRateLimitStatus } from "@/lib/server/security/control-plane"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "private, no-store", Vary: "Cookie, Authorization" }

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: NO_STORE })
  const rate = await checkDurableRateLimit(`research-project-update:${auth.userId}`, 30, 60_000, { onUnavailable: "deny" })
  if (!rate.ok) return NextResponse.json({ ok: false, error: durableRateLimitCode(rate) }, { status: durableRateLimitStatus(rate), headers: NO_STORE })
  if (!getServiceSupabaseConfig()) return NextResponse.json({ ok: false, error: "RESEARCH_STORAGE_UNAVAILABLE" }, { status: 503, headers: NO_STORE })
  const { id } = await context.params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404, headers: NO_STORE })
  const parsed = await readBoundedJson(request, 2 * 1024)
  if (!parsed.ok) return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400, headers: NO_STORE })
  const status = String((parsed.value as Record<string, unknown>).status || "")
  if (!new Set(["published", "paused", "closed", "draft"]).has(status)) return NextResponse.json({ ok: false, error: "INVALID_STATUS" }, { status: 400, headers: NO_STORE })
  const now = new Date().toISOString()
  const query = `gh_research_projects?id=eq.${encodeURIComponent(id)}&owner_user_id=eq.${encodeURIComponent(auth.userId)}&select=id,slug,title,status,published_at`
  const updated = await supabaseRest<Array<Record<string, unknown>>>(query, { method: "PATCH", headers: { "Content-Type": "application/json", Prefer: "return=representation" }, body: JSON.stringify({ status, updated_at: now, ...(status === "published" ? { published_at: now } : {}) }) })
  if (!updated.ok) return NextResponse.json({ ok: false, error: "RESEARCH_UPDATE_FAILED" }, { status: 503, headers: NO_STORE })
  if (!updated.data?.length) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404, headers: NO_STORE })
  return NextResponse.json({ ok: true, project: updated.data[0] }, { headers: NO_STORE })
}
