import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkDurableRateLimit } from "@/lib/server/security/control-plane"
import { readBoundedJson } from "@/lib/server/http/read-bounded-json"
import { socialRpc } from "@/lib/server/social/rpc"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
type Ctx = { params: Promise<{ callId: string }> }
const CALL_ID = /^call_[a-f0-9]{32}$/
const ACTIONS = new Set(["accept", "decline", "cancel", "end"])

export async function POST(request: Request, ctx: Ctx) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: { "Cache-Control": "no-store" } })
  const rl = await checkDurableRateLimit(`call-transition:${auth.userId}`, 30, 60_000, { onUnavailable: "deny" })
  if (!rl.ok) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429, headers: { "Cache-Control": "no-store" } })
  const { callId } = await ctx.params
  if (!CALL_ID.test(callId)) return NextResponse.json({ ok: false, error: "INVALID_CALL_ID" }, { status: 400, headers: { "Cache-Control": "no-store" } })
  const parsed = await readBoundedJson(request, 1024)
  if (!parsed.ok) return NextResponse.json({ ok: false, error: parsed.error }, { status: 400, headers: { "Cache-Control": "no-store" } })
  const action = typeof parsed.value.action === "string" ? parsed.value.action : ""
  if (!ACTIONS.has(action)) return NextResponse.json({ ok: false, error: "INVALID_TRANSITION" }, { status: 400, headers: { "Cache-Control": "no-store" } })
  const result = await socialRpc("gh_call_transition", { p_call_id: callId, p_actor_id: auth.userId, p_action: action })
  if (!result.ok) return NextResponse.json({ ok: false, error: "CALL_TRANSITION_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "no-store" } })
  const data = result.data && typeof result.data === "object" ? result.data as Record<string, unknown> : {}
  if (data.ok !== true) return NextResponse.json({ ok: false, error: typeof data.error === "string" ? data.error : "CALL_TRANSITION_REJECTED" }, { status: 409, headers: { "Cache-Control": "no-store" } })
  return NextResponse.json({ ok: true, call: data.call }, { headers: { "Cache-Control": "no-store" } })
}
