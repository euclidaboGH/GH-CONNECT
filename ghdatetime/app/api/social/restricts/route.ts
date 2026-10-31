/** POST /api/social/restricts — { targetUserId, restrict: boolean } */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { socialDbConfigured, socialRpc } from "@/lib/server/social/rpc"
import { nonDurableWriteResponse, nonDurableReadResponse } from "@/lib/server/production-guard"
import { readBoundedJson } from "@/lib/server/http/read-bounded-json"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }
  const parsedBody = await readBoundedJson(request, 4096)
  if (!parsedBody.ok) return NextResponse.json({ ok: false, error: parsedBody.error }, { status: parsedBody.error === "REQUEST_TOO_LARGE" ? 413 : 400, headers: { "Cache-Control": "no-store" } })
  const body = parsedBody.value
  const targetUserId = (typeof body.targetUserId === "string" ? body.targetUserId : "").trim()
  if (!targetUserId || targetUserId === auth.userId) {
    return NextResponse.json({ ok: false, error: "INVALID_TARGET" }, { status: 400 })
  }
  const restrict = body.restrict !== false && body.restrict !== "false"
  if (!socialDbConfigured()) {
    const nd = nonDurableWriteResponse("Restrict", { extra: { restricted: restrict } })
    return NextResponse.json(nd.body, { status: nd.status })
  }
  const result = await socialRpc("gh_restrict_set", {
    p_restrictor: auth.userId,
    p_restricted: targetUserId,
    p_restrict: restrict,
  })
  const data = result.data as { ok?: boolean; error?: string }
  if (!result.ok || data?.ok === false) {
    return NextResponse.json(
      { ok: false, error: data?.error || result.error || "RESTRICT_FAILED" },
      { status: 503 }
    )
  }
  return NextResponse.json({ ok: true, durable: true, restricted: restrict })
}
