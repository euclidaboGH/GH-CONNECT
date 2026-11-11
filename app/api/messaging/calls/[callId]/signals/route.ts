import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkDurableRateLimit } from "@/lib/server/security/control-plane"
import { readBoundedJson } from "@/lib/server/http/read-bounded-json"
import { socialRpc } from "@/lib/server/social/rpc"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
type Ctx = { params: Promise<{ callId: string }> }
const CALL_ID = /^call_[a-f0-9]{32}$/
const SIGNALS = new Set(["offer", "answer", "ice_candidate"])

export async function GET(request: Request, ctx: Ctx) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: { "Cache-Control": "no-store" } })
  const rl = await checkDurableRateLimit(`call-signals-read:${auth.userId}`, 180, 60_000, { onUnavailable: "deny" })
  if (!rl.ok) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429, headers: { "Cache-Control": "no-store" } })
  const { callId } = await ctx.params
  if (!CALL_ID.test(callId)) return NextResponse.json({ ok: false, error: "INVALID_CALL_ID" }, { status: 400, headers: { "Cache-Control": "no-store" } })
  const raw = new URL(request.url).searchParams.get("after") || "0"
  const after = Number(raw)
  if (!Number.isSafeInteger(after) || after < 0) return NextResponse.json({ ok: false, error: "INVALID_CURSOR" }, { status: 400, headers: { "Cache-Control": "no-store" } })
  const result = await socialRpc("gh_call_signal_list", { p_call_id: callId, p_actor_id: auth.userId, p_after_id: after })
  if (!result.ok) return NextResponse.json({ ok: false, error: "CALL_SIGNAL_READ_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "no-store" } })
  const data = result.data && typeof result.data === "object" ? result.data as Record<string, unknown> : {}
  if (data.ok !== true) return NextResponse.json({ ok: false, error: typeof data.error === "string" ? data.error : "CALL_SIGNAL_READ_DENIED" }, { status: 403, headers: { "Cache-Control": "no-store" } })
  return NextResponse.json({ ok: true, call: data.call, signals: Array.isArray(data.signals) ? data.signals : [] }, { headers: { "Cache-Control": "no-store" } })
}

export async function POST(request: Request, ctx: Ctx) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: { "Cache-Control": "no-store" } })
  const rl = await checkDurableRateLimit(`call-signals-write:${auth.userId}`, 100, 60_000, { onUnavailable: "deny" })
  if (!rl.ok) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429, headers: { "Cache-Control": "no-store" } })
  const { callId } = await ctx.params
  if (!CALL_ID.test(callId)) return NextResponse.json({ ok: false, error: "INVALID_CALL_ID" }, { status: 400, headers: { "Cache-Control": "no-store" } })
  const parsed = await readBoundedJson(request, 20 * 1024)
  if (!parsed.ok) return NextResponse.json({ ok: false, error: parsed.error }, { status: parsed.error === "REQUEST_TOO_LARGE" ? 413 : 400, headers: { "Cache-Control": "no-store" } })
  const kind = typeof parsed.value.kind === "string" ? parsed.value.kind : ""
  const payload = parsed.value.payload
  if (!SIGNALS.has(kind) || !payload || typeof payload !== "object" || Array.isArray(payload)) return NextResponse.json({ ok: false, error: "INVALID_SIGNAL" }, { status: 400, headers: { "Cache-Control": "no-store" } })
  const result = await socialRpc("gh_call_signal_append", { p_call_id: callId, p_actor_id: auth.userId, p_signal_kind: kind, p_payload: payload })
  if (!result.ok) return NextResponse.json({ ok: false, error: "CALL_SIGNAL_WRITE_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "no-store" } })
  const data = result.data && typeof result.data === "object" ? result.data as Record<string, unknown> : {}
  if (data.ok !== true) return NextResponse.json({ ok: false, error: typeof data.error === "string" ? data.error : "CALL_SIGNAL_REJECTED" }, { status: 409, headers: { "Cache-Control": "no-store" } })
  return NextResponse.json({ ok: true, signalId: data.signalId }, { headers: { "Cache-Control": "no-store" } })
}
