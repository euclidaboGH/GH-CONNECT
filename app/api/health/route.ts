import { NextResponse } from "next/server"

/** Lightweight health check for deploy / uptime monitors */
export const dynamic = "force-dynamic"
export const runtime = "edge"

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      service: "gh-connect",
      version: "0.52.0",
      ts: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  )
}
