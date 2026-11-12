import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { readGhcServerEnv } from "@/lib/server/economy/env"
import { nonDurableWriteResponse, nonDurableReadResponse } from "@/lib/server/production-guard"
import { readBoundedJson } from "@/lib/server/http/read-bounded-json"
import { enforceUserMutationRateLimit } from "@/lib/server/security/user-rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  try {
    const auth = await resolveAuthenticatedUser(req.headers)
    if (!auth?.userId) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 })
    }
    const __rateLimited = await enforceUserMutationRateLimit(auth.userId, "connections/decline:POST", 60, 60_000, { failClosed: false })
    if (__rateLimited) return __rateLimited
    const parsedBody = await readBoundedJson(req, 4_096)
    if (!parsedBody.ok) {
      return NextResponse.json({ ok: false, error: parsedBody.error }, { status: parsedBody.error === "REQUEST_TOO_LARGE" ? 413 : 400 })
    }
    const body = parsedBody.value as { fromUserId?: string }
    const fromUserId = String(body.fromUserId || "").trim()
    if (!fromUserId) {
      return NextResponse.json({ ok: false, error: "INVALID_PAIR" }, { status: 400 })
    }
    const env = readGhcServerEnv()
    if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
      const nd = nonDurableWriteResponse("Connection decline")
      return NextResponse.json(nd.body, { status: nd.status })
    }
    const res = await fetch(`${env.supabaseUrl}/rest/v1/rpc/ghc_connection_request_decline`, {
      method: "POST",
      headers: {
        apikey: env.supabaseServiceRoleKey,
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_actor_user_id: auth.userId,
        p_from_user_id: fromUserId,
      }),
    })
    if (!res.ok) {
      const nd = nonDurableWriteResponse("Connection decline")
      return NextResponse.json(nd.body, { status: nd.status })
    }
    const row = await res.json().catch(() => null)
    return NextResponse.json({ ok: true, durable: true, request: row })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "decline_failed" },
      { status: 500 }
    )
  }
}
