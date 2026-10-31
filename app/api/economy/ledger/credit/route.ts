/**
 * POST /api/economy/ledger/credit
 *
 * Phase 6 policy: manual, promotional, and admin credits are disabled. Existing
 * ledger history is preserved; no new credits may be created through this route.
 * Corrections must use an audited compensating-entry process outside this API.
 */
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { jsonErr } from "@/lib/server/economy/http"

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return jsonErr("AUTH_REQUIRED", "Authentication required", 401)

  return jsonErr(
    "GHC_ISSUANCE_POLICY_LOCKED",
    "New GHC is currently issued only through Daily Claim. Manual credits are disabled.",
    403
  )
}
