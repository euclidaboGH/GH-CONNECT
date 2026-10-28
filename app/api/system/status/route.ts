/** GET /api/system/status — operator-only, read-only deployment diagnostics. */
import { timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"
import { testnetUnlockSnapshot } from "@/lib/server/economy/testnet-unlock"
import { readGhcServerEnv, hasPrivilegedDatabase } from "@/lib/server/economy/env"
import { isDatabaseConfigured } from "@/lib/server/economy/http"
import { backendAuthoritySnapshot } from "@/lib/server/platform/backend-authority"
import { BACKEND_CONTRACT_VERSION } from "@/lib/server/platform/backend-contracts"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function reply(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache", Vary: "Authorization, X-GH-System-Status-Key" },
  })
}

function authorized(request: Request): boolean {
  const expected = Buffer.from(String(process.env.GH_SYSTEM_STATUS_OPERATOR_KEY || ""), "utf8")
  const supplied = Buffer.from(String(request.headers.get("x-gh-system-status-key") || ""), "utf8")
  return expected.length >= 32 && supplied.length === expected.length && timingSafeEqual(supplied, expected)
}

export async function GET(request: Request) {
  // This endpoint reports privileged configuration and backend capabilities.
  // Deny by default unless a dedicated, high-entropy operator secret is configured.
  if (!authorized(request)) return reply({ ok: false, error: "FORBIDDEN" }, 403)

  try {
    const env = readGhcServerEnv()
    const flags = testnetUnlockSnapshot()
    const supabase = {
      urlPresent: Boolean(env.supabaseUrl),
      serviceRolePresent: Boolean(env.supabaseServiceRoleKey),
      privilegedDatabase: hasPrivilegedDatabase(),
      economyDbConfigured: isDatabaseConfigured(),
    }
    const probes: Record<string, string> = {}
    const base = env.supabaseUrl?.replace(/\/$/, "")
    const key = env.supabaseServiceRoleKey

    // Only GET probes are permitted here. Never POST empty arguments to privileged RPCs:
    // a function can have side effects even when invoked with an empty payload.
    if (base && key) {
      const headers = { apikey: key, Authorization: `Bearer ${key}` }
      for (const [label, path] of [
        ["table:gh_media_assets", "/rest/v1/gh_media_assets?select=id&limit=0"],
        ["table:gh_conversation_members", "/rest/v1/gh_conversation_members?select=conversation_id&limit=0"],
      ] as const) {
        try {
          const response = await fetch(`${base}${path}`, { method: "GET", headers, cache: "no-store", signal: AbortSignal.timeout(5_000) })
          probes[label] = response.status === 404 ? "MISSING" : response.ok ? "PRESENT" : `HTTP_${response.status}`
        } catch {
          probes[label] = "UNREACHABLE"
        }
      }
    }

    const blockers: string[] = []
    if (!supabase.urlPresent || !supabase.serviceRolePresent) blockers.push("SUPABASE_CONFIGURATION_MISSING")
    if (probes["table:gh_media_assets"] === "MISSING") blockers.push("MEDIA_ASSET_TABLE_MISSING")
    if (probes["table:gh_conversation_members"] === "MISSING") blockers.push("CONVERSATION_MEMBERS_TABLE_MISSING")
    if (flags.activityRewards && !supabase.economyDbConfigured) blockers.push("ACTIVITY_REWARDS_DATABASE_NOT_CONFIGURED")

    return reply({
      ok: blockers.length === 0,
      version: process.env.npm_package_version || "unknown",
      flags,
      supabase,
      probes,
      backendContract: { version: BACKEND_CONTRACT_VERSION },
      authorities: backendAuthoritySnapshot(),
      blockers,
      diagnostics: "read-only; bucket provisioning and RPC execution are not performed by this endpoint",
    })
  } catch {
    // Avoid reflecting exception messages, URLs, SQL, or provider response bodies.
    return reply({ ok: false, error: "STATUS_FAILED" }, 500)
  }
}
