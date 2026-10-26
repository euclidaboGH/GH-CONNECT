/**
 * Lightweight authenticated probes — no secrets, never blocks UI.
 * Used after session resume / reconnect to surface operator-visible issues via events.
 */

export type FeatureHealthSnapshot = {
  appHealth: "ok" | "degraded" | "down" | "unknown"
  media: "ok" | "degraded" | "down" | "unknown"
  at: number
}

export async function probeFeatureHealth(): Promise<FeatureHealthSnapshot> {
  const at = Date.now()
  let appHealth: FeatureHealthSnapshot["appHealth"] = "unknown"
  let media: FeatureHealthSnapshot["media"] = "unknown"
  try {
    const res = await fetch("/api/health", { cache: "no-store", credentials: "include" })
    const body = (await res.json().catch(() => ({}))) as { status?: string; ready?: boolean }
    if (!res.ok && res.status >= 500) appHealth = "down"
    else if (body.status === "ready" || body.ready === true) appHealth = "ok"
    else if (body.status === "degraded") appHealth = "degraded"
    else appHealth = res.ok ? "degraded" : "down"
  } catch {
    appHealth = "down"
  }
  try {
    const res = await fetch("/api/media/health", { cache: "no-store", credentials: "include" })
    const body = (await res.json().catch(() => ({}))) as {
      ok?: boolean
      bucketReachable?: boolean | null
    }
    if (!res.ok && res.status >= 500) media = "down"
    else if (body.ok === false || body.bucketReachable === false) media = "degraded"
    else if (res.ok) media = "ok"
    else media = "degraded"
  } catch {
    media = "down"
  }
  try {
    window.dispatchEvent(
      new CustomEvent("ghc:feature-health", {
        detail: { appHealth, media, at },
      }),
    )
  } catch {
    /* */
  }
  return { appHealth, media, at }
}
