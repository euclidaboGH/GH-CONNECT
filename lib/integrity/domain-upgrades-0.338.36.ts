/**
 * 0.338.36 — Cross-domain integrity upgrades (30).
 * Domains: curation, A2U withdrawal, authentication, withdrawal authorization,
 * rewards, payments pipelines, profile, posts.
 * Production remains NOT APPROVED. No silent fund movement.
 */

/** CURATION (1–5) */
export const CURATION_SELF_VOTE_CLIENT_BLOCK = true
export const CURATION_DEBOUNCE_MS = 400
export const CURATION_DAILY_QUOTA_HINT = 120
export const CURATION_REQUIRES_AUTH = true
export const CURATION_NO_LOCAL_LEDGER_MINT = true

/** A2U / WITHDRAWAL (6–10) */
export const A2U_RESERVE_ONLY_ON_ACCEPTED_PAYOUT = true
export const A2U_QUOTE_DOES_NOT_RESERVE = true
export const A2U_WITHDRAWAL_PIN_REQUIRED = true
export const A2U_CONSENT_DOES_NOT_RESERVE = true
export const A2U_PRODUCTION_REQUIRES_IDENTITY_MAP = true

/** AUTHENTICATION (11–14) */
export const AUTH_SESSION_MAX_ACTIVE_DEFAULT = 8
export const AUTH_STEP_UP_FOR_WITHDRAWAL = true
export const AUTH_CREDENTIALS_INCLUDE = "include" as const
export const AUTH_NO_STORE_CACHE = "no-store" as const

/** WITHDRAWAL AUTHORIZATION (15–17) */
export const WITHDRAW_AUTH_BIND_PI_UID = true
export const WITHDRAW_AUTH_TIMEOUT_MS = 10_000
export const WITHDRAW_AUTH_FAIL_CLOSED_UNMAPPED = true

/** REWARDS (18–21) */
export const REWARDS_CLAIM_EMITS_WALLET_REFRESH = true
export const REWARDS_MISSIONS_SERVER_AUTHORITATIVE = true
export const REWARDS_NO_INVENTED_BALANCE = true
export const REWARDS_DAILY_CLAIM_IDEMPOTENT = true

/** PAYMENTS PIPELINES (22–25) */
export const PAYMENTS_FINANCIAL_TIMEOUT_MS = 45_000
export const PAYMENTS_READ_TIMEOUT_MS = 12_000
export const PAYMENTS_IDEMPOTENCY_REQUIRED = true
export const PAYMENTS_COMMISSION_BPS_FIXED = 500

/** PROFILE (26–28) */
export const PROFILE_NO_BLOB_PUBLISH = true
export const PROFILE_PUBLIC_PROJECTION_STRIP_FINANCIAL = true
export const PROFILE_MEDIA_DURABLE_ONLY = true

/** POSTS (29–30) */
export const POST_ENGAGEMENT_BUS_EVENT = "ghc:post-engagement"
export const POST_CURATION_USES_SERVER_COUNTS = true

export const DOMAIN_UPGRADE_COUNT = 30
export const DOMAIN_UPGRADE_VERSION = "0.338.36"
