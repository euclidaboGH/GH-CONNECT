/**
 * POST /api/verification/review
 * Privileged approve/reject/revoke — server only.
 * Requires GHC_VERIFICATION_SERVER=1 and service authorization.
 *
 * GET  /api/verification/review
 * List pending queue for authorized reviewers.
 *
 * Approving updates the durable request row. Badge/reputation authority
 * remains separate (trust-authority / verification domain); this API does
 * not invent external identity providers.
 */
import { NextRequest, NextResponse } from "next/server"
import {
  listPendingForReview,
  updateVerificationRequestStatus,
  type VerificationRequestType,
} from "@/lib/server/verification/request-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function authorize(req: NextRequest): boolean {
  if (process.env.GHC_VERIFICATION_SERVER !== "1") return false
  const serviceKey =
    process.env.VERIFICATION_REVIEW_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  const provided =
    req.headers.get("x-verification-secret") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
  return Boolean(serviceKey && provided && provided === serviceKey)
}

export async function GET(req: NextRequest) {
  if (process.env.GHC_VERIFICATION_SERVER !== "1") {
    return NextResponse.json(
      {
        ok: false,
        error: "VERIFICATION_PRIVILEGED_BLOCKED",
        message: "Verification review is not enabled on this server.",
      },
      { status: 403 }
    )
  }
  if (!authorize(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
  }
  const pending = await listPendingForReview(50)
  return NextResponse.json({ ok: true, pending })
}

export async function POST(req: NextRequest) {
  if (process.env.GHC_VERIFICATION_SERVER !== "1") {
    return NextResponse.json(
      {
        ok: false,
        error: "VERIFICATION_PRIVILEGED_BLOCKED",
        message: "Verification review is not enabled on this server.",
      },
      { status: 403 }
    )
  }

  if (!authorize(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const action = String(body?.action || "")
    const targetUserId = String(body?.targetUserId || "")
    const type = String(body?.type || "identity") as VerificationRequestType
    const requestId =
      typeof body?.requestId === "string" ? body.requestId : undefined
    const reviewNote =
      typeof body?.note === "string" ? body.note.slice(0, 500) : undefined
    const reviewerId = String(body?.reviewerId || "server-reviewer").slice(0, 120)

    if (!["approve", "reject", "revoke"].includes(action) || !targetUserId) {
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 })
    }
    if (!["identity", "creator", "business", "organization"].includes(type)) {
      return NextResponse.json({ ok: false, error: "invalid_type" }, { status: 400 })
    }

    const status =
      action === "approve"
        ? ("approved" as const)
        : action === "reject"
          ? ("rejected" as const)
          : ("revoked" as const)

    const updated = await updateVerificationRequestStatus({
      id: requestId,
      userId: targetUserId,
      type,
      status,
      reviewerId,
      reviewNote,
    })

    if (!updated.ok) {
      const http =
        updated.code === "NOT_FOUND"
          ? 404
          : updated.code === "DURABLE_REQUIRED" || updated.code === "DURABLE_WRITE_FAILED"
            ? 503
            : 400
      return NextResponse.json(
        {
          ok: false,
          error: updated.code || "REVIEW_FAILED",
          message: updated.error,
          durable: false,
        },
        { status: http }
      )
    }

    return NextResponse.json({
      ok: true,
      action,
      targetUserId,
      type,
      request: updated.request,
      status: updated.request.status,
      durable: true,
      // Explicit: request row status is not the same as TrustBadge authority
      message:
        "Review decision persisted on verification request. Badge/reputation still follow trust-authority rules.",
    })
  } catch {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 })
  }
}
