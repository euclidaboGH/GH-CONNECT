import { timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"
import { listTreasuryCases, upsertTreasuryCase } from "@/lib/server/revenue/treasury-operations"
import { readBoundedJson } from "@/lib/server/http/read-bounded-json"

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
  const result = await listTreasuryCases(100)
  return result?.ok ? reply(result) : reply({ ok: false, error: "TREASURY_CASES_UNAVAILABLE" }, 503)
}
export async function POST(request: Request) {
  if (!authorized(request)) return reply({ ok: false, error: "FORBIDDEN" }, 403)
  const parsedBody = await readBoundedJson(request, 32 * 1024)
  if (!parsedBody.ok) return reply({ ok: false, error: parsedBody.error }, parsedBody.error === "REQUEST_TOO_LARGE" ? 413 : 400)
  const body = parsedBody.value
  const text = (v: unknown, max: number) => typeof v === "string" ? v.trim().slice(0, max) : ""
  const caseKey = text(body.caseKey, 220), sourceKind = text(body.sourceKind, 40), sourceId = text(body.sourceId, 160)
  const summary = text(body.summary, 500), actor = text(body.actor, 160), note = text(body.note, 2000)
  const status = text(body.status, 20), priority = text(body.priority, 20), eventType = text(body.eventType, 30)
  if (!caseKey || !sourceKind || !sourceId || !summary || !actor || (status && !["open", "investigating", "resolved", "dismissed"].includes(status)) || (priority && !["low", "normal", "high", "critical"].includes(priority)))
    return reply({ ok: false, error: "INVALID_CASE_INPUT" }, 400)
  const result = await upsertTreasuryCase({ caseKey, sourceKind, sourceId, summary, actor, note: note || undefined,
    status: status || undefined, priority: priority || undefined, eventType: eventType || (status ? "status_changed" : "note_added") })
  return result?.ok ? reply(result) : reply({ ok: false, error: result?.error || "TREASURY_CASE_WRITE_UNAVAILABLE" }, 503)
}
