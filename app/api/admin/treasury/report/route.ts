import { timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"
import { getTreasuryFinancialReport } from "@/lib/server/revenue/treasury-operations"
export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const headers = { "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache" }
function reply(body: unknown, status = 200) { return NextResponse.json(body, { status, headers }) }
function authorized(request: Request) {
  const key = String(process.env.GHC_OPERATOR_RECONCILE_KEY || process.env.GHC_ADMIN_API_KEY || process.env.GHC_A2U_ADMIN_KEY || "").trim()
  if (Buffer.byteLength(key, "utf8") < 32) return false
  const supplied = Buffer.from(request.headers.get("x-ghc-operator-key") || "", "utf8"), expected = Buffer.from(key, "utf8")
  return supplied.length === expected.length && timingSafeEqual(supplied, expected)
}
export async function GET(request: Request) {
  if (!authorized(request)) return reply({ ok: false, error: "FORBIDDEN" }, 403)
  const url = new URL(request.url), startsAt = url.searchParams.get("startsAt"), endsAt = url.searchParams.get("endsAt")
  if (!startsAt || !endsAt || startsAt.length > 40 || endsAt.length > 40) return reply({ ok: false, error: "REPORTING_WINDOW_REQUIRED" }, 400)
  const start = Date.parse(startsAt), end = Date.parse(endsAt)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || end - start > 93 * 86400000) return reply({ ok: false, error: "INVALID_REPORTING_WINDOW" }, 400)
  const report = await getTreasuryFinancialReport(new Date(start).toISOString(), new Date(end).toISOString())
  if (!report?.ok) return reply({ ok: false, error: "TREASURY_REPORT_UNAVAILABLE", degraded: true }, 503)
  return reply(report)
}
