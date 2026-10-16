/**
 * Client helpers to hydrate / persist social profile against server authority.
 * Does not treat localStorage as source of truth for cross-device data.
 */

export type ServerProfileHydrateResult = {
  ok: boolean
  exists: boolean
  durable: boolean
  profile: Record<string, unknown> | null
  error?: string
}

export async function fetchServerProfile(): Promise<ServerProfileHydrateResult> {
  try {
    const res = await fetch("/api/profile/me", {
      method: "GET",
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok || !body?.ok) {
      return {
        ok: false,
        exists: false,
        durable: Boolean(body?.durable),
        profile: null,
        error: body?.error || `HTTP_${res.status}`,
      }
    }
    return {
      ok: true,
      exists: Boolean(body.exists),
      durable: Boolean(body.durable),
      profile: body.profile && typeof body.profile === "object" ? body.profile : null,
    }
  } catch (e) {
    return {
      ok: false,
      exists: false,
      durable: false,
      profile: null,
      error: e instanceof Error ? e.message : "network",
    }
  }
}

export async function persistServerProfile(
  partial: Record<string, unknown>
): Promise<{ ok: boolean; profile?: Record<string, unknown>; error?: string }> {
  try {
    const res = await fetch("/api/profile/me", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(partial),
      cache: "no-store",
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok || !body?.ok) {
      return { ok: false, error: body?.error || `HTTP_${res.status}` }
    }
    return {
      ok: true,
      profile: body.profile && typeof body.profile === "object" ? body.profile : undefined,
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "network" }
  }
}

export async function fetchServerAchievements(): Promise<{
  ok: boolean
  achievements: Array<{ achievementId: string; unlockedAt: number }>
  progress: { counters: Record<string, number> } | null
  durable: boolean
}> {
  try {
    const res = await fetch("/api/profile/achievements", {
      method: "GET",
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok || !body?.ok) {
      return { ok: false, achievements: [], progress: null, durable: false }
    }
    return {
      ok: true,
      achievements: Array.isArray(body.achievements) ? body.achievements : [],
      progress: body.progress || null,
      durable: Boolean(body.durable),
    }
  } catch {
    return { ok: false, achievements: [], progress: null, durable: false }
  }
}
