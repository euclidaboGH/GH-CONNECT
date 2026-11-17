/**
 * GH Ads — Pi Ad Network adapter (scaffold).
 *
 * Rules:
 * - Detect capability via Pi.nativeFeaturesList() when available.
 * - Never grant GHC from client "ad completed" alone.
 * - Rewarded claims must hit /api/ads/verify with adId; server verifies with Pi.
 * - Monetization remains gated until Pi approval + env enablement.
 */

export type PiAdKind = "interstitial" | "rewarded"

export interface AdCapability {
  available: boolean
  reason?: string
}

export interface AdShowResult {
  ok: boolean
  adId?: string
  kind: PiAdKind
  error?: string
}

/** Client-side capability probe only — no rewards. */
export async function detectAdNetworkCapability(): Promise<AdCapability> {
  if (typeof window === "undefined") {
    return { available: false, reason: "SERVER" }
  }
  try {
    const Pi = (window as unknown as { Pi?: { nativeFeaturesList?: () => Promise<string[]> } }).Pi
    if (!Pi?.nativeFeaturesList) {
      return { available: false, reason: "PI_SDK_UNAVAILABLE" }
    }
    const features = await Pi.nativeFeaturesList()
    const list = Array.isArray(features) ? features.map(String) : []
    if (list.includes("ad_network")) {
      return { available: true }
    }
    return { available: false, reason: "AD_NETWORK_NOT_IN_FEATURES" }
  } catch {
    return { available: false, reason: "PROBE_FAILED" }
  }
}

/**
 * Placeholder show path — real Pi Ads SDK calls land here later.
 * Returns NOT_IMPLEMENTED until GH_ADS_ENABLED + Pi integration complete.
 */
export async function showPiAd(_kind: PiAdKind): Promise<AdShowResult> {
  const cap = await detectAdNetworkCapability()
  if (!cap.available) {
    return { ok: false, kind: _kind, error: cap.reason || "UNAVAILABLE" }
  }
  return { ok: false, kind: _kind, error: "ADS_NOT_ENABLED" }
}

/** Submit adId for server verification — never mint GHC in the client. */
export async function submitRewardedAdForVerification(adId: string): Promise<{
  ok: boolean
  verified?: boolean
  error?: string
}> {
  const id = String(adId || "").trim()
  if (!id) return { ok: false, error: "MISSING_AD_ID" }
  try {
    const res = await fetch("/api/ads/verify", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ adId: id }),
    })
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean
      verified?: boolean
      error?: string
    }
    return {
      ok: data.ok === true,
      verified: Boolean(data.verified) && data.ok === true,
      // Never invent rewards client-side
      error: data.error,
    }
  } catch {
    return { ok: false, error: "NETWORK" }
  }
}
