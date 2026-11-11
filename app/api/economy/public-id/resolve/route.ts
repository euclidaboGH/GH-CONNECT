/**
 * GET /api/economy/public-id/resolve?id=GH-XXXXXX
 * Resolve a public GreenHaven ID to minimal public profile fields.
 * Does not return email, phone, balance, or tokens.
 */

import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { jsonErr, jsonOk } from "@/lib/server/economy/http"
import {
  resolvePublicIdentity,
  toPublicIdentityDto,
} from "@/lib/server/economy/public-id"
import { isValidGreenHavenIdFormat } from "@/lib/domains/greenhaven-id"

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return jsonErr("AUTH_REQUIRED", "Authentication required", 401)

  const url = new URL(request.url)
  const id = url.searchParams.get("id") || ""
  if (!isValidGreenHavenIdFormat(id)) {
    return jsonErr("INVALID_ID", "Invalid GreenHaven ID", 400)
  }

  const row = await resolvePublicIdentity(id)
  if (!row) {
    return jsonErr("NOT_FOUND", "GreenHaven user not found", 404)
  }

  // Public projection only — recipientKey allowed for authenticated senders
  return jsonOk(toPublicIdentityDto(row))
}
