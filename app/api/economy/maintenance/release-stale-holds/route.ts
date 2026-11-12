/**
 * GET|POST /api/economy/maintenance/release-stale-holds[?dryRun=1]
 *
 * Scheduled by Vercel Cron (see vercel.json). Returns Pi earnings reservations and GHC withdrawal
 * locks that are older than 24h to Available, but only where no provider activity is possible
 * (see supabase/migrations/20261112100001_financial_stale_hold_reaper.sql). Anything that may have
 * reached Pi (processing / uncertain / provider evidence) is reported, never released.
 *
 * Auth: Authorization: Bearer <CRON_SECRET>. Disabled (503) when CRON_SECRET is not configured.
 */
import { timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"
import { readGhcServerEnv } from "@/lib/server/economy/env"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const headers = { "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache" }
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers })

function authorized(request: Request) {
  const secret = String(process.env.CRON_SECRET || "")
  if (secret.length < 16) return "unconfigured" as const
  const supplied = String(request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "")
  const a = Buffer.from(secret, "utf8")
  const b = Buffer.from(supplied, "utf8")
  return a.length === b.length && timingSafeEqual(a, b) ? ("ok" as const) : ("denied" as const)
}

async function handle(request: Request) {
  const auth = authorized(request)
  if (auth === "unconfigured") return reply({ ok: false, error: "CRON_SECRET_NOT_CONFIGURED" }, 503)
  if (auth === "denied") return reply({ ok: false, error: "UNAUTHORIZED" }, 401)

  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    return reply({ ok: false, error: "DATABASE_NOT_CONFIGURED" }, 503)
  }

  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1"
  try {
    const response = await fetch(`${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/gh_financial_release_stale_holds`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        apikey: env.supabaseServiceRoleKey,
        authorization: `Bearer ${env.supabaseServiceRoleKey}`,
      },
      body: JSON.stringify({ p_max_age_hours: 24, p_dry_run: dryRun, p_limit: 200 }),
      signal: AbortSignal.timeout(30_000),
    })
    const data = (await response.json().catch(() => null)) as Record<string, any> | null
    if (!response.ok || !data || data.ok !== true) {
      console.error("[stale-hold-reaper] rpc failed", { status: response.status })
      return reply({ ok: false, error: "STALE_HOLD_RELEASE_FAILED" }, 502)
    }
    const piReleased = Array.isArray(data.piReleased) ? data.piReleased.length : 0
    const ghcReleased = Array.isArray(data.ghcReleased) ? data.ghcReleased.length : 0
    const piHeld = Array.isArray(data.piHeldForReconciliation) ? data.piHeldForReconciliation.length : 0
    const ghcHeld = Array.isArray(data.ghcHeldProcessing) ? data.ghcHeldProcessing.length : 0
    const failed = Array.isArray(data.failed) ? data.failed : []
    console.info("[stale-hold-reaper]", { dryRun, piReleased, ghcReleased, piHeld, ghcHeld, failed: failed.length })
    if (failed.length) console.warn("[stale-hold-reaper] rows not released", failed)
    return reply({ ok: true, dryRun, piReleased, ghcReleased, piHeld, ghcHeld, failed, held: { pi: data.piHeldForReconciliation, ghc: data.ghcHeldProcessing } })
  } catch {
    return reply({ ok: false, error: "STALE_HOLD_RELEASE_UNAVAILABLE" }, 503)
  }
}

export const GET = handle
export const POST = handle
