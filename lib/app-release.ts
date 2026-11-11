/** Release identity; session integrity and release gates are versioned with this source. */
export const APP_RELEASE_VERSION = "0.338.51"

/** Concise, privacy-safe release note shown in the authenticated in-app update notice. */
export const APP_RELEASE_SUMMARY =
  "Run #288 removes a permissions-hook type escape hatch and binds UI permission checks to the hydrated account identity; Run #287 repairs the app shell module structure. Full Node 24 validation remains pending."
