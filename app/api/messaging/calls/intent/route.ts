/**
 * Legacy call-intent endpoint retirement.
 *
 * Live calls use the authenticated durable call-session, transition and signal
 * routes. This old metadata-only endpoint never created a call or persisted an
 * intent, so it now fails explicitly without buffering an untrusted request body.
 */
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error: "CALL_INTENT_RETIRED",
      message: "This legacy endpoint is retired. Start calls through the authenticated call-session flow.",
    },
    {
      status: 410,
      headers: { "Cache-Control": "no-store, private", Vary: "Cookie, Authorization" },
    },
  )
}
