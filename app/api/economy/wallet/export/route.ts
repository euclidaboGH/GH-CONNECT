import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { readGhcServerEnv } from "@/lib/server/economy/env"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function csvCell(value: unknown): string {
  let text = value == null ? "" : String(value)
  // Avoid spreadsheet formula injection in exported free-text fields.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  const rl = checkRateLimit(`wallet-export:${auth.userId}`, 3, 60 * 60_000)
  if (!rl.ok) return NextResponse.json({ ok: false, error: "RATE_LIMITED", retryAfterSec: rl.retryAfterSec }, { status: 429 })
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return NextResponse.json({ ok: false, error: "DATABASE_UNAVAILABLE" }, { status: 503 })
  try {
    const url = `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/ghc_transactions?user_id=eq.${encodeURIComponent(auth.userId)}&select=id,kind,amount,status,reason,source_event,reference_id,created_at,posted_at,metadata&order=created_at.desc&limit=1000`
    const response = await fetch(url, { headers: { apikey: env.supabaseServiceRoleKey, Authorization: `Bearer ${env.supabaseServiceRoleKey}` }, cache: "no-store" })
    if (!response.ok) return NextResponse.json({ ok: false, error: "WALLET_EXPORT_FAILED" }, { status: 503 })
    const rows = await response.json() as Array<Record<string, unknown>>
    const headers = ["id", "kind", "amount", "status", "reason", "source_event", "reference_id", "created_at", "posted_at", "metadata"]
    const csv = [headers.map(csvCell).join(","), ...rows.map((row) => headers.map((key) => csvCell(key === "metadata" ? JSON.stringify(row[key] || {}) : row[key])).join(","))].join("\r\n")
    return new Response(csv, { status: 200, headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="ghc-wallet-history.csv"`, "Cache-Control": "no-store" } })
  } catch { return NextResponse.json({ ok: false, error: "WALLET_EXPORT_FAILED" }, { status: 503 }) }
}
