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
  SANDBOX: true,
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
