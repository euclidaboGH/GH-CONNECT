/**
 * GET/POST /api/economy/public-id/me
 * Ensure and return the authenticated user's GreenHaven public ID.
 */

import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { jsonErr, jsonOk } from "@/lib/server/economy/http"
import {
  ensurePublicIdentity,
  toPublicIdentityDto,
} from "@/lib/server/economy/public-id"
import { deriveGreenHavenId } from "@/lib/domains/greenhaven-id"

import { readBoundedJson } from "@/lib/server/http/read-bounded-json"

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return jsonErr("AUTH_REQUIRED", "Authentication required", 401)

  const preferred = deriveGreenHavenId(auth.userId)
  const row = await ensurePublicIdentity({
    userId: auth.userId,
    preferred,
  })
  if (!row) {
    return jsonErr("SERVER_UNAVAILABLE", "Could not ensure public identity", 503)
  }

  return jsonOk({
    ...toPublicIdentityDto(row),
    // Owner may see their own recipientKey
    userId: row.userId,
  })
}

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return jsonErr("AUTH_REQUIRED", "Authentication required", 401)

  const parsedBody = await readBoundedJson(request, 16 * 1024)
  if (!parsedBody.ok) return jsonErr(parsedBody.error, parsedBody.error === "REQUEST_TOO_LARGE" ? "Request too large" : "Invalid request body", parsedBody.error === "REQUEST_TOO_LARGE" ? 413 : 400)
  const body = parsedBody.value as { displayName?: string; avatarUrl?: string }

  const preferred = deriveGreenHavenId(auth.userId)
  const row = await ensurePublicIdentity({
    userId: auth.userId,
    displayName: body.displayName,
    avatarUrl: body.avatarUrl,
    preferred,
  })
  if (!row) {
    return jsonErr("SERVER_UNAVAILABLE", "Could not ensure public identity", 503)
  }

  return jsonOk({
    ...toPublicIdentityDto(row),
    userId: row.userId,
  })
}
