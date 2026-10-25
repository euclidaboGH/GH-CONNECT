/**
 * GET /api/payments/recovery/status
 * Read-only: lists the caller's payment intents that may need recovery attention.
 * Does not invent timestamps or fabricate provider state.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { listIntentsForUserAsync } from "@/lib/server/payments/intent-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const noStore = { "Cache-Control": "no-store" }

const ATTENTION = new Set([
  "CREATED",
  "APPROVAL_PENDING",
  "APPROVED",
  "USER_SUBMITTED",
  "COMPLETION_PENDING",
  "INCOMPLETE",
  "COMPLETED", // paid but fulfilment may be pending
])

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: noStore })
  }

  try {
    if (typeof listIntentsForUserAsync !== "function") {
      return NextResponse.json(
        {
          ok: true,
          items: [],
          note: "Intent list helper is not available in this build; open individual payment receipts to recover.",
        },
        { headers: noStore },
      )
    }
    const rows = await listIntentsForUserAsync(auth.userId)
    const items = (Array.isArray(rows) ? rows : [])
      .filter((row) => {
        const st = String(row.status || "").toUpperCase()
        return ATTENTION.has(st) && st !== "FULFILLED" && st !== "CANCELLED" && st !== "REFUNDED"
      })
      .slice(0, 40)
      .map((row) => ({
        id: row.id,
        status: row.status,
        purpose: row.purpose,
        amount: row.amount,
        currency: row.currency,
        referenceId: row.referenceId,
        providerPaymentId: row.providerPaymentId || null,
        createdAt: row.createdAt,
        // Honest flags only
        mayNeedProviderLookup: !["COMPLETED", "FULFILLED", "FAILED", "CANCELLED", "REFUNDED"].includes(
          String(row.status || "").toUpperCase(),
        ),
        mayNeedFulfilment: String(row.status || "").toUpperCase() === "COMPLETED",
      }))

    return NextResponse.json(
      {
        ok: true,
        count: items.length,
        items,
        note: "Only durable intents owned by the authenticated user are listed. No synthetic recovery steps are invented here.",
      },
      { headers: noStore },
    )
  } catch {
    return NextResponse.json(
      { ok: false, error: "RECOVERY_STATUS_UNAVAILABLE" },
      { status: 503, headers: noStore },
    )
  }
}
