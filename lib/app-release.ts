/** Release identity; session integrity and release gates are versioned with this source. */
export const APP_RELEASE_VERSION = "0.338.73"

/** Concise, privacy-safe release note shown in the authenticated in-app update notice. */
export const APP_RELEASE_SUMMARY =
  "Run #310 strengthens Phase 6 telemetry by keeping CLS session-window tracking constant-memory and retaining the slowest bounded interaction samples for more representative INP measurement. Feed privacy, identity bounds and financial authority remain unchanged; no database migration or production approval is implied."
