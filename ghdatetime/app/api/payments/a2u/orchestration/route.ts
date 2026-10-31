/**
 * Phase 7 — Operator A2U orchestration: open reviews + stuck jobs.
 * Requires x-ghc-operator-key (same family as reconcile/admin keys).
 */
import { NextResponse } from "next/server"
import { timingSafeEqual } from "node:crypto"
import {
  listOpenA2uReviews,
  listStuckA2uJobs,
  resolveA2uReview,
} from "@/lib/server/payments/a2u-orchestration"

import { readBoundedJson } from "@/lib/server/http/read-bounded-json"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const noStore = { "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache" }
function reply(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: noStore })
}

function authorized(request: Request): boolean {
  const expected = String(
    process.env.GHC_OPERATOR_RECONCILE_KEY || process.env.GHC_A2U_ADMIN_KEY || "",
  ).trim()
  if (!expected || expected.length < 16) return false
  const supplied = Buffer.from(String(request.headers.get("x-ghc-operator-key") || ""), "utf8")
  const want = Buffer.from(expected, "utf8")
  if (supplied.length !== want.length) return false
  try {
    return timingSafeEqual(supplied, want)
  } catch {
    return false
  }
}

export async function GET(request: Request) {
  if (!authorized(request)) return reply({ ok: false, error: "FORBIDDEN" }, 403)
  const url = new URL(request.url)
  const older = Math.min(24 * 60, Math.max(5, Number(url.searchParams.get("olderThanMinutes") || 30) || 30))
  const [reviews, stuck] = await Promise.all([
    listOpenA2uReviews(50),
    listStuckA2uJobs(older),
  ])
  return reply({
    ok: true,
    reviews: reviews?.items || [],
    stuck: stuck || { cashback: [], seller: [] },
    rules: [
      "Never mark paid solely because a payment request was sent",
      "Recover matching incomplete payments before createPayment",
      "Unrelated incomplete → attention + review queue",
      "Settlement requires provider completed + binding + verified txid",
    ],
  })
}

export async function POST(request: Request) {
  if (!authorized(request)) return reply({ ok: false, error: "FORBIDDEN" }, 403)
  const parsedBody = await readBoundedJson(request, 16 * 1024)
  if (!parsedBody.ok) return reply({ ok: false, error: parsedBody.error }, parsedBody.error === "REQUEST_TOO_LARGE" ? 413 : 400)
  const body = parsedBody.value as { reviewId?: string; status?: string; note?: string }
  const reviewId = String(body.reviewId || "").trim()
  const status = String(body.status || "").trim()
  if (!reviewId || (status !== "resolved" && status !== "dismissed")) {
    return reply({ ok: false, error: "INVALID_INPUT" }, 400)
  }
  const result = await resolveA2uReview({
    reviewId,
    status,
    note: body.note,
  })
  if (!result?.ok) {
    return reply({ ok: false, error: result?.error || "RESOLVE_FAILED" }, 409)
  }
  return reply({ ok: true, reviewId, status })
}
