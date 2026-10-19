/** Owner-scoped JSON export. Fails closed if any required source cannot be read; never includes secrets or service credentials. */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { readGhcServerEnv } from "@/lib/server/economy/env"
import { requireRecentStepUp } from "@/lib/server/identity/step-up-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type ExportSource = { key: string; path: string }
const EXPORT_PAGE_SIZE = 1000
const EXPORT_MAX_ROWS_PER_SOURCE = 20000

async function readCompleteExportSource(base: string, serviceKey: string, source: ExportSource): Promise<[string, unknown[]]> {
  const all: unknown[] = []
  for (let offset = 0; offset <= EXPORT_MAX_ROWS_PER_SOURCE; offset += EXPORT_PAGE_SIZE) {
    const pageSize = Math.min(EXPORT_PAGE_SIZE, EXPORT_MAX_ROWS_PER_SOURCE - offset || 1)
    const response = await fetch(`${base}/rest/v1/${source.path}`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, Accept: "application/json", Range: `${offset}-${offset + pageSize - 1}`, "Range-Unit": "items", Prefer: "count=exact" },
      cache: "no-store",
    })
    if (!response.ok) throw new Error("SOURCE_UNAVAILABLE")
    const page = await response.json()
    if (!Array.isArray(page)) throw new Error("SOURCE_INVALID")
    if (offset === EXPORT_MAX_ROWS_PER_SOURCE) {
      if (page.length) throw new Error("SOURCE_ROW_LIMIT_EXCEEDED")
      return [source.key, all]
    }
    all.push(...page)
    if (page.length < pageSize) return [source.key, all]
  }
  // Fail closed at the configured ceiling rather than silently truncating an export.
  throw new Error("SOURCE_ROW_LIMIT_EXCEEDED")
}
function reply(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache", Vary: "Cookie, Authorization", "X-Content-Type-Options": "nosniff" } })
}

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return reply({ ok: false, error: "AUTH_REQUIRED" }, 401)
  const stepUp = await requireRecentStepUp(auth)
  if (stepUp) return reply({ ok: false, error: stepUp.code, message: stepUp.message }, stepUp.status)
  const rl = checkRateLimit(`account-export:${auth.userId}`, 2, 60 * 60_000)
  if (!rl.ok) return reply({ ok: false, error: "RATE_LIMITED", retryAfterSec: rl.retryAfterSec }, 429)
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return reply({ ok: false, error: "EXPORT_UNAVAILABLE" }, 503)

  // Explicit allowlist + per-table ownership filters; never accept a table/column name from the client.
  const uid = encodeURIComponent(auth.userId)
  const sources: ExportSource[] = [
    { key: "posts", path: `gh_posts?author_id=eq.${uid}&select=id,content,visibility,created_at,updated_at,deleted_at,like_count,comment_count,share_count&order=created_at.asc` },
    { key: "comments", path: `gh_post_comments?author_id=eq.${uid}&select=id,post_id,text,parent_id,created_at,deleted_at&order=created_at.asc` },
    { key: "reactions", path: `gh_post_reactions?user_id=eq.${uid}&select=post_id,reaction,created_at&order=created_at.asc` },
    { key: "creatorProfile", path: `gh_creator_profiles?user_id=eq.${uid}&select=user_id,display_name,tagline,bio,is_enabled,tips_enabled,created_at,updated_at` },
    { key: "tipsSent", path: `gh_tip_intents?tipper_id=eq.${uid}&select=id,recipient_id,content_id,content_kind,amount_units,currency,status,note,created_at,updated_at&order=created_at.asc` },
    { key: "tipsReceived", path: `gh_tip_intents?recipient_id=eq.${uid}&select=id,tipper_id,content_id,content_kind,amount_units,currency,status,note,created_at,updated_at&order=created_at.asc` },
    { key: "marketplaceOrdersBought", path: `gh_marketplace_orders?buyer_id=eq.${uid}&select=id,listing_id,listing_title,seller_id,quantity,unit_price,currency,total_amount,status,payment_method,payment_status,created_at,updated_at&order=created_at.asc` },
    { key: "marketplaceOrdersSold", path: `gh_marketplace_orders?seller_id=eq.${uid}&select=id,listing_id,listing_title,buyer_id,quantity,unit_price,currency,total_amount,status,payment_method,payment_status,created_at,updated_at&order=created_at.asc` },
    { key: "mediaAssets", path: `gh_media_assets?owner_id=eq.${uid}&select=id,media_kind,mime_type,byte_size,width,height,duration_ms,status,created_at,deleted_at&order=created_at.asc` },
  ]
  try {
    const base = env.supabaseUrl.replace(/\/$/, "")
    const results = await Promise.all(sources.map(source => readCompleteExportSource(base, env.supabaseServiceRoleKey!, source)))
    const data = Object.fromEntries(results)
    return reply({ ok: true, format: "greenhaven-account-export-v1", generatedAt: new Date().toISOString(), userId: auth.userId, scope: "complete records from the explicitly listed GreenHaven tables, subject to the per-source safety ceiling; excludes authentication secrets and data held by external providers", data }, 200)
  } catch {
    return reply({ ok: false, error: "EXPORT_INCOMPLETE", message: "The export could not safely collect every included data source or exceeded the per-source safety ceiling. No partial export was returned; retry later or contact support." }, 503)
  }
}
