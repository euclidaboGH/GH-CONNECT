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
   * Production checklist (item 10) needs sandbox: false on the live URL.
   * Override with NEXT_PUBLIC_PI_SANDBOX=true for Develop/sandbox only.
   */
  SANDBOX:
    typeof process !== "undefined" && process.env.NEXT_PUBLIC_PI_SANDBOX != null
      ? process.env.NEXT_PUBLIC_PI_SANDBOX === "true"
      : false,
  /**
   * When remote SDKLite cannot load (App Studio preview, offline, CDN block),
   * allow a local authenticated session so onboarding is not blocked.
   * Real Pi Browser production should still load the official scripts.
   */
  ALLOW_LOCAL_AUTH_FALLBACK: true,
  /** Parent postMessage credential probe timeout (ms) */
  PARENT_CREDENTIAL_TIMEOUT_MS: 4000,
  /** Script load timeout (ms) */
  SCRIPT_LOAD_TIMEOUT_MS: 12000,
} as const
