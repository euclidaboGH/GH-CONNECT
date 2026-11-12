/** Release identity; session integrity and release gates are versioned with this source. */
export const APP_RELEASE_VERSION = "0.338.61"

/** Concise, privacy-safe release note shown in the authenticated in-app update notice. */
export const APP_RELEASE_SUMMARY =
  "Run #296 hardens onboarding and profile registration: no synthetic age or connection-goal defaults, durable profile-photo upload, server-confirmed step persistence, and a server-side completion gate. Existing Run #295 held migrations and all financial safeguards remain unchanged; Node 24 validation and Pi Browser acceptance remain pending."
