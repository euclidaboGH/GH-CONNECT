/**
 * Server-side proof for reputation events.
 * Client event type alone is never sufficient.
 */
import { readGhcServerEnv } from "@/lib/server/economy/env"
import type { ReputationEventType } from "@/lib/server/reputation/config"

type RestGetSuccess = {
  ok: true
  data: unknown
}

type RestGetFailure = {
  ok: false
  data: null
  error: string
}

type RestGetResult = RestGetSuccess | RestGetFailure

async function restGet(
  pathAndQuery: string
): Promise<RestGetResult> {
  const env = readGhcServerEnv()

  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    return {
      ok: false,
      data: null,
      error: "DB_UNAVAILABLE",
    }
  }

  try {
    const res = await fetch(
      `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/${pathAndQuery.replace(
        /^\//,
        ""
      )}`,
      {
        headers: {
          Accept: "application/json",
          apikey: env.supabaseServiceRoleKey,
          Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
        },
        cache: "no-store",
      }
    )

    const data = await res.json().catch(() => null)

    if (!res.ok) {
      const errorObject =
        data &&
        typeof data === "object" &&
        !Array.isArray(data)
          ? (data as Record<string, unknown>)
          : null

      return {
        ok: false,
        data: null,
        error: String(
          (errorObject &&
            (errorObject.message || errorObject.error)) ||
            `HTTP_${res.status}`
        ),
      }
    }

    return {
      ok: true,
      data,
    }
  } catch (e) {
    return {
      ok: false,
      data: null,
      error: e instanceof Error ? e.message : "NETWORK",
    }
  }
}

/**
 * Profile complete: requires durable profile row with onboarded=true
 * and a non-empty display_name (authoritative GH profile).
 */
export async function verifyProfileComplete(
  userId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const q =
    `gh_user_profiles?gh_user_id=eq.${encodeURIComponent(userId)}` +
    `&select=gh_user_id,onboarded,display_name&limit=1`

  const res = await restGet(q)

  if (!res.ok) {
    return {
      ok: false,
      error: res.error || "PROOF_FAILED",
    }
  }

  const rows = Array.isArray(res.data) ? res.data : []

  const row = rows[0] as
    | {
        gh_user_id?: string
        onboarded?: boolean
        display_name?: string | null
      }
    | undefined

  if (!row) {
    return {
      ok: false,
      error: "PROFILE_NOT_FOUND",
    }
  }

  if (row.onboarded !== true) {
    return {
      ok: false,
      error: "PROFILE_NOT_ONBOARDED",
    }
  }

  if (!String(row.display_name || "").trim()) {
    return {
      ok: false,
      error: "PROFILE_INCOMPLETE",
    }
  }

  return {
    ok: true,
  }
}

/**
 * First post: at least one non-deleted post authored by user.
 */
export async function verifyFirstPost(
  userId: string
): Promise<
  | { ok: true; postId: string }
  | { ok: false; error: string }
> {
  const q =
    `gh_posts?author_id=eq.${encodeURIComponent(userId)}` +
    `&deleted_at=is.null&select=id&order=created_at.asc&limit=1`

  const res = await restGet(q)

  if (!res.ok) {
    return {
      ok: false,
      error: res.error || "PROOF_FAILED",
    }
  }

  const rows = Array.isArray(res.data) ? res.data : []

  const row = rows[0] as
    | {
        id?: string
      }
    | undefined

  if (!row?.id) {
    return {
      ok: false,
      error: "NO_QUALIFYING_POST",
    }
  }

  return {
    ok: true,
    postId: String(row.id),
  }
}

/**
 * Returns forced idempotency key for naturally unique actions,
 * or null if event type is not client-awardable.
 */
export function forcedIdempotencyKey(
  eventType: ReputationEventType,
  userId: string
): string | null {
  if (eventType === "profile_complete") {
    return `profile_complete:${userId}`
  }

  if (eventType === "first_post") {
    return `first_post:${userId}`
  }

  return null
}

/** Events that may be requested via public POST after server proof */
export const CLIENT_AWARDABLE_EVENTS: readonly ReputationEventType[] = [
  "profile_complete",
  "first_post",
] as const