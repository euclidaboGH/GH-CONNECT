import { NextResponse } from "next/server"
import {
  clearFieldSessionCookie,
  fieldAccessConfigured,
  fieldTokenFromRequest,
} from "@/lib/server/field/access"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const token = fieldTokenFromRequest(request)
  return NextResponse.json(
    {
      ok: true,
      configured: fieldAccessConfigured(),
      authenticated: Boolean(token),
      label: token?.label || null,
      exp: token?.exp || null,
    },
    { headers: { "Cache-Control": "no-store" } },
  )
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } })
  res.headers.append("Set-Cookie", clearFieldSessionCookie())
  return res
}
