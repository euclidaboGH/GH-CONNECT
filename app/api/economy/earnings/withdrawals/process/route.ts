/**
 * POST /api/economy/earnings/withdrawals/process  { requestId }
 *
 * Opt-in, Testnet-only trigger that lets a signed-in user's OWN reserved withdrawal request be
 * handed to the dedicated payout worker (../execute) without exposing the executor key to the browser.
 *
 * Safety:
 *  - Disabled unless PI_EARNINGS_AUTO_EXECUTE === "true" (explicit operator opt-in).
 *  - The executor key is added server-side only; any client-supplied key header is discarded.
 *  - All real checks (session, ownership of the request, wallet consent, testnet-only flags,
 *    credentials, lease/idempotency, Pi read-after-write verification) stay inside the worker.
 */
import { NextResponse } from "next/server"
import { POST as executeWorker } from "../execute/route"
import { readBoundedText } from "@/lib/server/http/read-bounded-text"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const headers = { "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache" }
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers })

export async function POST(request: Request) {
  if (process.env.PI_EARNINGS_AUTO_EXECUTE !== "true") {
    return reply({ ok: false, error: "PI_EARNINGS_AUTO_EXECUTE_DISABLED" }, 503)
  }
  const key = String(process.env.PI_EARNINGS_EXECUTOR_KEY || process.env.GHC_A2U_ADMIN_KEY || "")
  if (key.length < 16) return reply({ ok: false, error: "EXECUTOR_KEY_NOT_CONFIGURED" }, 503)

  const boundedBody = await readBoundedText(request, 8 * 1024)
  if (!boundedBody.ok) return reply({ ok: false, error: boundedBody.error === "REQUEST_TOO_LARGE" ? "REQUEST_TOO_LARGE" : "INVALID_BODY" }, boundedBody.error === "REQUEST_TOO_LARGE" ? 413 : 400)
  const raw = boundedBody.text
  if (raw.length > 8 * 1024) return reply({ ok: false, error: "REQUEST_TOO_LARGE" }, 413)

  const forwarded = new Headers(request.headers)
  forwarded.delete("content-length")
  forwarded.delete("x-ghc-a2u-admin-key")
  forwarded.set("content-type", "application/json")
  forwarded.set("x-ghc-pi-earnings-key", key)

  return executeWorker(
    new Request(new URL("/api/economy/earnings/withdrawals/execute", request.url), {
      method: "POST",
      headers: forwarded,
      body: raw,
    }),
  )
}
