/**
 * Phase 5 — Cashback period reconciliation report.
 * GET ?startsAt=&endsAt= — service/admin key required (not a user faucet).
 */
import { NextResponse } from "next/server"
import { operatorDiagnosticsAuthorized } from "@/lib/server/security/operator-key"
import {
  getCashbackAttributionPolicy,
  reconcileCashbackPeriod,
} from "@/lib/server/revenue/cashback-attribution"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const noStore = { "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache" }
function reply(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: noStore })
}

function authorized(request: Request): boolean {
  return operatorDiagnosticsAuthorized(request)
}

export async function GET(request: Request) {
  if (!authorized(request)) return reply({ ok: false, error: "FORBIDDEN" }, 403)
  const url = new URL(request.url)
  const startsAt = String(url.searchParams.get("startsAt") || "").trim()
  const endsAt = String(url.searchParams.get("endsAt") || "").trim()
  if (!startsAt || !endsAt) {
    return reply({
      ok: true,
      policy: getCashbackAttributionPolicy(),
      message: "Provide startsAt and endsAt ISO timestamps to run reconciliation.",
    })
  }
  if (Number.isNaN(Date.parse(startsAt)) || Number.isNaN(Date.parse(endsAt))) {
    return reply({ ok: false, error: "INVALID_WINDOW" }, 400)
  }
  const report = await reconcileCashbackPeriod({ startsAt, endsAt })
  if (!report.ok) {
    return reply({ ok: false, error: report.error || "RECONCILE_FAILED", policy: getCashbackAttributionPolicy() }, 503)
  }
  return reply({ ok: true, report, policy: getCashbackAttributionPolicy() })
}
