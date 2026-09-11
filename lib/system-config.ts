import { resolvePiSandbox } from "@/lib/pi-env"

function currentSandboxFlag(): boolean {
  const host =
    typeof window !== "undefined" ? window.location.hostname : null
  return resolvePiSandbox({ hostname: host })
}

export const PI_NETWORK_CONFIG = {
  SDK_URL: "https://sdk.minepi.com/pi-sdk.js",
  /** Primary SDKLite CDN (may fail in App Studio iframe / network policy) */
  SDK_LITE_URL: "https://pi-apps.github.io/pi-sdk-lite/build/production/sdklite.js",
  /** Fallbacks tried in order if primary fails */
  SDK_LITE_URL_FALLBACKS: [
    "https://sdk.minepi.com/sdk-lite/sdklite.js",
    "https://cdn.jsdelivr.net/gh/pi-apps/pi-sdk-lite@main/build/production/sdklite.js",
  ] as readonly string[],
  BACKEND_URL: "https://backend.appstudio-u7cm9zhmha0ruwv8.piappengine.com",
  /** Pi Developer Portal app slug (public) */
  APP_SLUG: "gh-connect-4a60bc91d8ef4a84",
  /**
   * Connected app wallet on Pi (public identifier for U2A — not a secret).
   * Server API Key must NEVER be placed in client code — use env PI_API_KEY only.
   */
  CONNECTED_APP: "GDF4JBEOAYRGMUVDFPNUHWOSLY6EDFQYDBDEJ7EV2LCL6FZXNFGZ3VDZ",
  /**
   * Sandbox / Testnet vs Mainnet for Pi SDK (read at use time via getter).
   * Prefer NEXT_PUBLIC_PI_SANDBOX; otherwise environment-aware (lib/pi-env.ts).
   */
  get SANDBOX(): boolean {
    return currentSandboxFlag()
  },
  /** @deprecated use allowLocalAuthFallback() */
  ALLOW_LOCAL_AUTH_FALLBACK: true,
  /** Parent postMessage credential probe timeout (ms) */
  PARENT_CREDENTIAL_TIMEOUT_MS: 4000,
  /** Script load timeout (ms) */
  SCRIPT_LOAD_TIMEOUT_MS: 12000,
}


/**
 * True only for Studio/localhost development.
 * Never for Vercel production, Pi Browser hosts, or production NODE_ENV —
 * even if NEXT_PUBLIC_ALLOW_LOCAL_AUTH is accidentally set.
 */
export function allowLocalAuthFallback(): boolean {
  // Server: never enable local auth on production runtimes
  if (typeof window === "undefined") {
    if (process.env.VERCEL_ENV === "production") return false
    if (process.env.NODE_ENV === "production") return false
    if (process.env.NEXT_PUBLIC_REQUIRE_PI_BROWSER === "true") return false
    return true
  }
  if (process.env.NEXT_PUBLIC_REQUIRE_PI_BROWSER === "true") return false
  const host = window.location.hostname.toLowerCase()
  // Production hosts first — env override cannot weaken this
  if (host.endsWith(".vercel.app")) return false
  if (host.endsWith("pinet.com") || host.endsWith("minepi.com")) return false
  if (process.env.NODE_ENV === "production" && host !== "localhost" && host !== "127.0.0.1") {
    return false
  }
  if (host === "localhost" || host === "127.0.0.1") return true
  if (process.env.NEXT_PUBLIC_ALLOW_LOCAL_AUTH === "true") return true
  return false
}

export function isProductionPiHost(): boolean {
  return !allowLocalAuthFallback()
}
