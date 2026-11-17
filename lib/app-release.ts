/** Release identity; session integrity and release gates are versioned with this source. */
export const APP_RELEASE_VERSION = "0.338.92"

/** Concise, privacy-safe release note shown in the authenticated in-app update notice. */
export const APP_RELEASE_SUMMARY =
  "Research evidence now supports project-scoped public respondent uploads and field-session-scoped field-agent uploads, streamed SHA-256 hashing, file-signature checks, quarantine-first delivery, a central evidence review workspace, scanner queue/callback contracts, validated geographic-unit references and append-only hash-chain events. New scoped evidence scan-status columns default to pending, so legacy and new evidence cannot be treated as malware-scanned without a trusted scanner attestation. Testnet Vercel Preview now has branch-scoped Supabase URL and private media bucket configuration. Testnet privileged service credentials, central admin identity and trusted scanner integration remain operator prerequisites; the three additive migrations are still held pending exact SQL reconciliation. Production remains NOT APPROVED."
