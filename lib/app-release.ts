/** Release identity; session integrity and release gates are versioned with this source. */
export const APP_RELEASE_VERSION = "0.338.64"

/** Concise, privacy-safe release note shown in the authenticated in-app update notice. */
export const APP_RELEASE_SUMMARY =
  "Run #299 fixes the Profile context TypeScript contract by using the canonical typed hook, removes an obsolete ESLint suppression, and adds 20 build/release regression guards. No financial authority, database schema, provider behavior or production approval is changed."
