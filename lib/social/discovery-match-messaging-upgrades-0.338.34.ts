/**
 * Run 0.338.34 — Discovery, matches, connect/follow, messaging & calls (30 upgrades).
 * Source-only contracts. Production calling remains fail-closed without TURN/signaling.
 */

/** 1 */ export const UPGRADE_DIRECT_CALL_CONTROLLER = true
/** 2 */ export const UPGRADE_CALL_POLICY_RELATIONSHIP_GATE = true
/** 3 */ export const UPGRADE_CALL_SHEET_HONEST_MEDIA = true
/** 4 */ export const UPGRADE_CALL_HISTORY_LOCAL = true
/** 5 */ export const UPGRADE_CHAT_HEADER_VOICE_VIDEO = true
/** 6 */ export const UPGRADE_CALL_RING_TIMEOUT_MS = 45_000
/** 7 */ export const UPGRADE_CALL_COOLDOWN_MS = 8_000
/** 8 */ export const UPGRADE_CALLS_PRODUCTION_ENABLED_DEFAULT = false
/** 9 */ export const UPGRADE_MESSAGE_THREAD_CALL_BRIDGE = true
/** 10 */ export const UPGRADE_DISCOVERY_EXCLUDE_SELF_ALIASES = true
/** 11 */ export const UPGRADE_DISCOVERY_EXCLUDE_FRIENDS_MATCHES_BLOCKED = true
/** 12 */ export const UPGRADE_CONNECT_REQUIRES_INTENT = true
/** 13 */ export const UPGRADE_FOLLOW_SOFT_REVALIDATE = true
/** 14 */ export const UPGRADE_MATCH_MUTUAL_OPENS_MESSAGE = true
/** 15 */ export const UPGRADE_INBOX_NAME_PHOTO_ENRICH = true
/** 16 */ export const UPGRADE_MESSAGE_OFFLINE_PERMANENT_FAIL = true
/** 17 */ export const UPGRADE_MESSAGE_IDEM_MAX = 80
/** 18 */ export const UPGRADE_MESSAGE_BODY_MAX = 8000
/** 19 */ export const UPGRADE_ATTACHMENT_MAX = 4
/** 20 */ export const UPGRADE_TYPING_LEASE_SECONDS = 6
/** 21 */ export const UPGRADE_PRESENCE_POLL_MIN_MS = 12_000
/** 22 */ export const UPGRADE_READ_RECEIPT_HONEST = true
/** 23 */ export const UPGRADE_MUTE_ARCHIVE_PIN_CLIENT = true
/** 24 */ export const UPGRADE_BLOCK_REPORT_FROM_THREAD = true
/** 25 */ export const UPGRADE_SHARED_MEDIA_PANEL = true
/** 26 */ export const UPGRADE_THREAD_SEARCH = true
/** 27 */ export const UPGRADE_DISCOVER_CLEAR_FILTERS_EMPTY = true
/** 28 */ export const UPGRADE_CONNECTION_REQUEST_BOUNDED_JSON = 8 * 1024
/** 29 */ export const UPGRADE_MATCH_SIGNAL_BOUNDED_JSON = 4 * 1024
/** 30 */ export const UPGRADE_CALL_SIGNALING_PROPOSAL_ONLY = true

export const DISCOVERY_MATCH_MESSAGING_UPGRADE_COUNT = 30
