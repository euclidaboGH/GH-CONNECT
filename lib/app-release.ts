/** Release identity; session integrity and release gates are versioned with this source. */
export const APP_RELEASE_VERSION = "0.338.25"

/** Concise, privacy-safe release note shown in the authenticated in-app update notice. */
export const APP_RELEASE_SUMMARY =
  "Run #258 repairs the Marketplace order-list RPC alias failure with a bounded, service-role-only read path; no orders, balances or payments are changed."
