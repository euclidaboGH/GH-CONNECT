/**
 * Phase 6 — Communities & Discovery integrity helpers.
 */
import { NextResponse } from "next/server"
import type { ServerAuthContext } from "@/lib/server/economy/auth"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { socialDbConfigured } from "@/lib/server/social/rpc"

export type CommunityAuthOk = { ok: true; auth: ServerAuthContext }
export type CommunityAuthFail = { ok: false; response: NextResponse }

function noStore(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, private" },
  })
}

export function sanitizeCommunityId(raw: unknown): string | null {
  const id = String(raw || "").trim()
  if (!id || id.length > 160) return null
  if (/[\u0000-\u001f\u007f]/.test(id)) return null
  return id
}

export async function requireCommunityAuth(headers: Headers): Promise<CommunityAuthOk | CommunityAuthFail> {
  const auth = await resolveAuthenticatedUser(headers)
  if (!auth) {
    return { ok: false, response: noStore({ ok: false, error: "AUTH_REQUIRED" }, 401) }
  }
  return { ok: true, auth }
}

export function requireDurableCommunityStoreInProduction(): CommunityAuthFail | { ok: true } {
  const isProd =
    process.env.VERCEL_ENV === "production" ||
    process.env.NODE_ENV === "production" ||
    process.env.GHC_ENV === "production"
  if (isProd && !socialDbConfigured()) {
    return {
      ok: false,
      response: noStore(
        {
          ok: false,
          error: "COMMUNITY_DURABILITY_UNAVAILABLE",
          message: "Community membership changes require a durable social store in production.",
        },
        503
      ),
    }
  }
  return { ok: true }
}

/** Map durable join RPC status to honest client-facing labels. */
export function mapJoinStatus(status: string | null | undefined): {
  status: string
  joinLabel: string
  isMember: boolean
  pendingApproval: boolean
} {
  const s = String(status || "").trim().toLowerCase()
  if (s === "active" || s === "member" || s === "joined") {
    return { status: "active", joinLabel: "Joined", isMember: true, pendingApproval: false }
  }
  if (s === "pending" || s === "requested" || s === "awaiting_approval") {
    return {
      status: "pending",
      joinLabel: "Request pending",
      isMember: false,
      pendingApproval: true,
    }
  }
  if (s === "banned" || s === "blocked") {
    return { status: "banned", joinLabel: "Unavailable", isMember: false, pendingApproval: false }
  }
  return { status: s || "unknown", joinLabel: "Join", isMember: false, pendingApproval: false }
}

export const COMMUNITY_PHASE = "6-communities-discovery" as const
