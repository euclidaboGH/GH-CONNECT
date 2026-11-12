/**
 * POST /api/economy/rewards/evaluate
 *
 * Phase 6 policy: generic activity/achievement/referral rewards are disabled.
 * New user-available GHC is issued only through the dedicated Daily Claim flow,
 * which creates a durable 48-hour pending entitlement. Transfers are redistribution,
 * not issuance. Re-enable this route only after an explicit policy change and audit.
 */
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { jsonErr } from "@/lib/server/economy/http"
import { enforceUserMutationRateLimit } from "@/lib/server/security/user-rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return jsonErr("AUTH_REQUIRED", "Authentication required", 401)
  const __rateLimited = await enforceUserMutationRateLimit(auth.userId, "economy/rewards/evaluate:POST", 12, 60_000, { failClosed: true })
  if (__rateLimited) return __rateLimited

  return jsonErr(
    "GHC_ISSUANCE_POLICY_LOCKED",
    "New GHC is currently issued only through Daily Claim. Activity rewards are disabled.",
    503
  )
}
