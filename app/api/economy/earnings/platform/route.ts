/** Phase 9 — Operator platform utility summary (fees, charity, sinks). */
import { NextResponse } from "next/server"
import { timingSafeEqual } from "node:crypto"
import { getPlatformUtilitySummary } from "@/lib/server/earnings/platform-utility"

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
  const summary = await getPlatformUtilitySummary()
  if (!summary?.ok) {
    return reply({ ok: false, error: summary?.error || "PLATFORM_SUMMARY_UNAVAILABLE" }, 503)
  }
  return reply({ ...summary, ok: true })
}
