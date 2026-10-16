/**
 * POST /api/verification/request
 * Authenticated user submits a verification request (pending only).
 * Does NOT grant verified status, badges, or reputation.
 *
 * GET  /api/verification/request
 * List the caller's own verification requests.
 */
import { NextRequest, NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import {
  createVerificationRequest,
  listRequestsForUser,
  type VerificationRequestType,
} from "@/lib/server/verification/request-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ALLOWED: VerificationRequestType[] = [
  "identity",
  "creator",
  "business",
  "organization",
]

export async function GET(req: NextRequest) {
  try {
    const auth = await resolveAuthenticatedUser(req.headers)
    if (!auth?.userId) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
    }
    const requests = await listRequestsForUser(auth.userId)
    return NextResponse.json({
      ok: true,
      requests,
      note: "Request status is independent of TrustBadge; pending does not grant verification.",
    })
  } catch {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await resolveAuthenticatedUser(req.headers)
    if (!auth?.userId) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const type = String(body?.type || "identity") as VerificationRequestType
    if (!ALLOWED.includes(type)) {
      return NextResponse.json({ ok: false, error: "invalid_type" }, { status: 400 })
    }

    const note =
      typeof body?.note === "string" ? body.note.slice(0, 500) : undefined
    const evidenceRefs = Array.isArray(body?.evidenceRefs)
      ? body.evidenceRefs.map(String).slice(0, 10)
      : undefined

    const result = await createVerificationRequest({
      userId: auth.userId,
      type,
      note,
      evidenceRefs,
    })

    if (!result.ok) {
      const status =
        result.code === "DURABLE_REQUIRED" || result.code === "DURABLE_WRITE_FAILED"
          ? 503
          : 400
      return NextResponse.json(
        {
          ok: false,
          error: result.code || "REQUEST_FAILED",
          message: result.error,
          // Explicit: failure or queue issues never grant verification
          status: "pending",
          granted: false,
        },
        { status }
      )
    }

    // Success = durable pending request only. Never verified.
    return NextResponse.json(
      {
        ok: true,
        request: result.request,
        idempotent: result.idempotent,
        status: "pending",
        granted: false,
        message:
          "Verification request accepted as pending only; does not grant verified status. A reviewer must approve separately.",
      },
      { status: result.idempotent ? 200 : 201 }
    )
  } catch {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 })
  }
}
