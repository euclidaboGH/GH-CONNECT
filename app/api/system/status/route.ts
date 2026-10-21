/**
 * GET /api/system/status — non-secret operator diagnostic.
 * Helps explain why media/rewards/messaging still fail after env is set.
 */
import { NextResponse } from "next/server"
import { readGhcServerEnv, hasPrivilegedDatabase } from "@/lib/server/economy/env"
import { isDatabaseConfigured } from "@/lib/server/economy/http"
import { ensureMediaBucket } from "@/lib/server/media/ensure-bucket"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const env = readGhcServerEnv()
    const storageBucket = String(process.env.GH_MEDIA_BUCKET || "gh-media").trim() || "gh-media"
    const flags = {
      activityRewards: String(process.env.GHC_ACTIVITY_REWARDS_ENABLED || "").trim() === "1",
      referralSettlement: String(process.env.GHC_REFERRAL_SETTLEMENT_ENABLED || "").trim() === "1",
      curationRedistribute: String(process.env.GHC_CURATION_REDISTRIBUTE_ENABLED || "").trim() === "1",
    }
    const supabase = {
      urlPresent: Boolean(env.supabaseUrl),
      serviceRolePresent: Boolean(env.supabaseServiceRoleKey),
      privilegedDatabase: hasPrivilegedDatabase(),
      economyDbConfigured: isDatabaseConfigured(),
    }

    let bucket: { ok: boolean; error?: string; created?: boolean } = { ok: false }
    if (supabase.urlPresent && supabase.serviceRolePresent) {
      bucket = await ensureMediaBucket(storageBucket)
    }

    // Probe critical RPCs (presence only — no side effects)
    const rpcProbe: Record<string, string> = {}
    if (env.supabaseUrl && env.supabaseServiceRoleKey) {
      const base = env.supabaseUrl.replace(/\/$/, "")
      const headers = {
        apikey: env.supabaseServiceRoleKey,
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
        "Content-Type": "application/json",
      }
      for (const name of [
        "gh_media_asset_create",
        "ghc_execute_daily_claim_v12",
      ] as const) {
        try {
          const res = await fetch(`${base}/rest/v1/rpc/${name}`, {
            method: "POST",
            headers,
            body: JSON.stringify({}),
            cache: "no-store",
          })
          // 404 = missing function; 400/PGRST = exists but bad args
          if (res.status === 404) rpcProbe[name] = "MISSING"
          else if (res.status >= 500) rpcProbe[name] = `ERROR_${res.status}`
          else rpcProbe[name] = "PRESENT"
        } catch {
          rpcProbe[name] = "UNREACHABLE"
        }
      }
      // table probe
      try {
        const t = await fetch(
          `${base}/rest/v1/gh_media_assets?select=id&limit=1`,
          { headers: { apikey: env.supabaseServiceRoleKey, Authorization: `Bearer ${env.supabaseServiceRoleKey}` }, cache: "no-store" }
        )
        rpcProbe["table:gh_media_assets"] = t.status === 404 ? "MISSING" : t.ok || t.status === 200 || t.status === 206 ? "PRESENT" : `HTTP_${t.status}`
      } catch {
        rpcProbe["table:gh_media_assets"] = "UNREACHABLE"
      }
      try {
        const t = await fetch(
          `${base}/rest/v1/gh_conversation_members?select=conversation_id&limit=1`,
          { headers: { apikey: env.supabaseServiceRoleKey, Authorization: `Bearer ${env.supabaseServiceRoleKey}` }, cache: "no-store" }
        )
        rpcProbe["table:gh_conversation_members"] = t.status === 404 ? "MISSING" : t.ok || t.status === 200 || t.status === 206 ? "PRESENT" : `HTTP_${t.status}`
      } catch {
        rpcProbe["table:gh_conversation_members"] = "UNREACHABLE"
      }
    }

    const blockers: string[] = []
    if (!supabase.urlPresent || !supabase.serviceRolePresent) {
      blockers.push("Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY on Vercel, then Redeploy.")
    }
    if (supabase.serviceRolePresent && bucket.ok === false) {
      blockers.push(`Storage bucket "${storageBucket}" not ready: ${bucket.error || "unknown"}. Create it in Supabase Storage or allow service-role create.`)
    }
    if (rpcProbe["gh_media_asset_create"] === "MISSING" && rpcProbe["table:gh_media_assets"] === "MISSING") {
      blockers.push("Apply media migration 20261001_gh_media_assets.sql (RPC + table).")
    }
    if (rpcProbe["ghc_execute_daily_claim_v12"] === "MISSING") {
      blockers.push("Apply economy daily-claim migration (ghc_execute_daily_claim_v12). Flags alone do not credit GHC.")
    }
    if (rpcProbe["table:gh_conversation_members"] === "MISSING") {
      blockers.push("Apply messaging migrations (gh_conversations / gh_conversation_members) or community chat stays FORBIDDEN.")
    }
    if (flags.activityRewards && !supabase.economyDbConfigured) {
      blockers.push("GHC_ACTIVITY_REWARDS_ENABLED=1 but economy DB not configured — mission GHC will stay at 0.")
    }

    return NextResponse.json(
      {
        ok: blockers.length === 0,
        version: process.env.npm_package_version || "unknown",
        flags,
        supabase,
        storage: { bucket: storageBucket, ...bucket },
        probes: rpcProbe,
        blockers,
        hint:
          blockers.length === 0
            ? "Configuration looks coherent. If users still fail, check Vercel function logs for the specific route."
            : "Env flags are not enough — missing tables/RPCs/bucket must be fixed in Supabase, then Redeploy.",
      },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: "STATUS_FAILED",
        message: e instanceof Error ? e.message : "unknown",
      },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    )
  }
}
