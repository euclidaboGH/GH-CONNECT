import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { supabaseRest, getServiceSupabaseConfig } from "@/lib/server/supabase/rest-client"
import { checkDurableRateLimit, durableRateLimitCode, durableRateLimitStatus } from "@/lib/server/security/control-plane"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "private, no-store", Vary: "Cookie, Authorization" }
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: NO_STORE })
  const rate = await checkDurableRateLimit(`research-inbox:${auth.userId}`, 120, 60_000, { onUnavailable: "deny" })
  if (!rate.ok) return NextResponse.json({ ok: false, error: durableRateLimitCode(rate) }, { status: durableRateLimitStatus(rate), headers: NO_STORE })
  if (!getServiceSupabaseConfig()) return NextResponse.json({ ok: false, error: "RESEARCH_STORAGE_UNAVAILABLE" }, { status: 503, headers: NO_STORE })
  const { id } = await context.params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404, headers: NO_STORE })
  const owner = await supabaseRest<Array<{ id: string }>>(`gh_research_projects?id=eq.${encodeURIComponent(id)}&owner_user_id=eq.${encodeURIComponent(auth.userId)}&select=id&limit=1`)
  if (!owner.ok || !owner.data?.length) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404, headers: NO_STORE })
  const responses = await supabaseRest<Array<Record<string, unknown>>>(`gh_research_responses?project_id=eq.${encodeURIComponent(id)}&select=id,answers,review_status,submitted_at&order=submitted_at.desc&limit=200`)
  if (!responses.ok) return NextResponse.json({ ok: false, error: "RESEARCH_INBOX_UNAVAILABLE" }, { status: 503, headers: NO_STORE })
  return NextResponse.json({ ok: true, responses: responses.data }, { headers: NO_STORE })
}
