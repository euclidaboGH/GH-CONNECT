/**
 * GET /api/auth/webauthn/credentials — list own passkeys (no secrets)
 * DELETE body { id } — revoke own passkey
 */

import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import {
  listCredentialsForUser,
  revokeCredentialForUser,
  toPublicCredential,
} from "@/lib/server/identity/webauthn-store"
import { checkRateLimit, pruneRateLimitBuckets } from "@/lib/server/economy/rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth?.sessionId || auth.source !== "gh_session") {
    return NextResponse.json(
      { ok: false, error: "SESSION_REQUIRED" },
      { status: 403, headers: { "Cache-Control": "no-store" } }
    )
  }
  pruneRateLimitBuckets()
  const rl = checkRateLimit(`webauthn_list:${auth.userId}`, 30, 60_000)
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "RATE_LIMITED" },
      { status: 429, headers: { "Cache-Control": "no-store" } }
    )
  }
  const list = await listCredentialsForUser(auth.userId)
  return NextResponse.json(
    { ok: true, credentials: list.map(toPublicCredential) },
    { headers: { "Cache-Control": "no-store" } }
  )
}

export async function DELETE(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth?.sessionId || auth.source !== "gh_session") {
    return NextResponse.json(
      { ok: false, error: "SESSION_REQUIRED" },
      { status: 403, headers: { "Cache-Control": "no-store" } }
    )
  }
  const body = await request.json().catch(() => ({}))
  const id = typeof body.id === "string" ? body.id.trim() : ""
  if (!id) {
    return NextResponse.json(
      { ok: false, error: "ID_REQUIRED" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    )
  }
  const result = await revokeCredentialForUser(auth.userId, id)
  if (result === "not_found") {
    return NextResponse.json(
      { ok: false, error: "NOT_FOUND" },
      { status: 404, headers: { "Cache-Control": "no-store" } }
    )
  }
  if (result === "forbidden") {
    return NextResponse.json(
      { ok: false, error: "FORBIDDEN" },
      { status: 403, headers: { "Cache-Control": "no-store" } }
    )
  }
  return NextResponse.json(
    { ok: true, revoked: true },
    { headers: { "Cache-Control": "no-store" } }
  )
}
