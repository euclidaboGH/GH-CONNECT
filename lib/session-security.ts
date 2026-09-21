/**
 * Device session security for GreenHaven (auth-security domain — client half).
 *
 * Architecture:
 *
 *   GH SERVER SESSION (authoritative — Phase 2B)
 *     HttpOnly cookie; API authorization
 *
 *   LOCAL APP LOCK (UX + device threat mitigation — this module)
 *     ACTIVE ↔ LOCKED / AUTHENTICATING
 *     Protects against unlocked-phone access (Threat A)
 *     Does NOT replace server auth for money (Threat B/C)
 *     Does NOT authorize GHC transfers by being unlocked
 *
 * Rules:
 * - PIN is never a second Pi identity; it only unlocks the local shell.
 * - Only salted hash is stored on-device (not plaintext PIN).
 * - PIN is never sent to the server for unlock.
 * - Financial authority remains server + Pi Wallet approve/complete.
 * - SHA-256(salt:pin) is a practical browser baseline, NOT a slow KDF.
 *   Prefer future WebAuthn/passkeys; do not treat client PIN as MFA for APIs.
 */

const STORAGE_PREFIX = "gh_session_sec_v1:"
const POLICY_KEY = "gh_session_policy_v1:"
/** Shared across tabs (localStorage) so lock is not tab-isolated */
const GLOBAL_LAST_ACTIVITY = "gh_session_last_activity_v1"
const LAST_UNLOCK_AT = "gh_session_last_unlock_v1"
const LOCK_FLAG = "gh_session_soft_locked_v1"
/** Broadcast channel key for multi-tab lock sync */
export const LOCK_SYNC_KEY = "gh_session_lock_sync_v1"

/** Max failed PIN attempts before forcing Pi re-auth */
export const MAX_PIN_FAILURES = 5
export const PIN_MIN_LEN = 4
export const PIN_MAX_LEN = 8

/** How recently unlock counts for client-side step-up UX (not server authority) */
export const STEP_UP_FRESH_MS = 2 * 60 * 1000 // 2 minutes

export type LockPolicyId = "high" | "balanced" | "convenience"

export type LockPolicy = {
  id: LockPolicyId
  label: string
  description: string
  /** Idle time before soft-lock while app is visible */
  idleLockMs: number
  /** Lock when document becomes hidden (background / tab switch / call) */
  lockOnBackground: boolean
  /** Optional grace after background before lock (0 = immediate) */
  backgroundGraceMs: number
}

export const LOCK_POLICIES: Record<LockPolicyId, LockPolicy> = {
  high: {
    id: "high",
    label: "High security",
    description: "Lock immediately when you leave the app. Short idle timeout.",
    idleLockMs: 60_000,
    lockOnBackground: true,
    backgroundGraceMs: 0,
  },
  balanced: {
    id: "balanced",
    label: "Balanced",
    description: "Lock after 30s in background. 3-minute idle timeout.",
    idleLockMs: 3 * 60_000,
    lockOnBackground: true,
    backgroundGraceMs: 30_000,
  },
  convenience: {
    id: "convenience",
    label: "Convenience",
    description: "Lock after 5 minutes idle. Background grace 2 minutes.",
    idleLockMs: 5 * 60_000,
    lockOnBackground: true,
    backgroundGraceMs: 2 * 60_000,
  },
}

export const DEFAULT_LOCK_POLICY: LockPolicyId = "balanced"

/** Client security state machine (UI only — not server auth) */
export type AppSecurityState =
  | "ACTIVE"
  | "LOCKED"
  | "AUTHENTICATING"
  | "SESSION_EXPIRED"
  | "SESSION_REVOKED"
  | "SIGNED_OUT"
  | "REAUTH_REQUIRED"

export type SensitiveAction =
  | "messages"
  | "settings"
  | "security_settings"
  | "ghc_transfer"
  | "ghc_spend"
  | "pi_payment"
  | "change_pin"

/** Client UX only — server must still authorize financial routes */
export const STEP_UP_ACTIONS: Record<SensitiveAction, boolean> = {
  messages: false,
  settings: false,
  security_settings: true,
  ghc_transfer: true,
  ghc_spend: true,
  pi_payment: true,
  change_pin: true,
}

export type SessionSecurityRecord = {
  userId: string
  /** hex SHA-256(salt + pin) — never plaintext */
  pinHash: string
  salt: string
  enabled: boolean
  createdAt: number
  updatedAt: number
  failCount: number
  lockedUntil: number | null
}

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}${encodeURIComponent(userId)}`
}

function policyKey(userId: string): string {
  return `${POLICY_KEY}${encodeURIComponent(userId)}`
}

function randomSalt(): string {
  const bytes = new Uint8Array(16)
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

async function sha256Hex(message: string): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const data = new TextEncoder().encode(message)
    const buf = await crypto.subtle.digest("SHA-256", data)
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  }
  // Weak fallback only for non-secure contexts; still never store plaintext
  let h = 0
  for (let i = 0; i < message.length; i++) {
    h = (Math.imul(31, h) + message.charCodeAt(i)) | 0
  }
  return `fallback_${(h >>> 0).toString(16)}`
}

/**
 * Hash PIN with per-user salt.
 * Uses SHA-256 — fast; adequate only for local UX friction, not server MFA.
 * Documented limitation: not PBKDF2/scrypt/Argon2 (no extra deps; browser-compatible).
 */
export async function hashPin(pin: string, salt: string): Promise<string> {
  return sha256Hex(`${salt}:${pin}`)
}

export function loadSecurityRecord(userId: string): SessionSecurityRecord | null {
  if (typeof localStorage === "undefined" || !userId) return null
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as SessionSecurityRecord
    if (!parsed?.pinHash || !parsed?.salt) return null
    return parsed
  } catch {
    return null
  }
}

function saveSecurityRecord(rec: SessionSecurityRecord): void {
  if (typeof localStorage === "undefined") return
  try {
    localStorage.setItem(storageKey(rec.userId), JSON.stringify(rec))
  } catch {
    /* quota */
  }
}

export function hasPinConfigured(userId: string): boolean {
  const rec = loadSecurityRecord(userId)
  return Boolean(rec?.enabled && rec.pinHash)
}

export function getLockPolicy(userId: string): LockPolicy {
  if (typeof localStorage === "undefined" || !userId) {
    return LOCK_POLICIES[DEFAULT_LOCK_POLICY]
  }
  try {
    const id = localStorage.getItem(policyKey(userId)) as LockPolicyId | null
    if (id && LOCK_POLICIES[id]) return LOCK_POLICIES[id]
  } catch {
    /* */
  }
  return LOCK_POLICIES[DEFAULT_LOCK_POLICY]
}

export function setLockPolicy(userId: string, id: LockPolicyId): void {
  if (typeof localStorage === "undefined" || !userId) return
  if (!LOCK_POLICIES[id]) return
  try {
    localStorage.setItem(policyKey(userId), id)
  } catch {
    /* */
  }
}

export async function setupPin(
  userId: string,
  pin: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const cleaned = String(pin || "").replace(/\D/g, "")
  if (cleaned.length < PIN_MIN_LEN || cleaned.length > PIN_MAX_LEN) {
    return {
      ok: false,
      error: `PIN must be ${PIN_MIN_LEN}–${PIN_MAX_LEN} digits`,
    }
  }
  if (!userId || userId === "current-user") {
    return { ok: false, error: "Sign in with Pi before setting a PIN" }
  }
  const salt = randomSalt()
  const pinHash = await hashPin(cleaned, salt)
  const now = Date.now()
  saveSecurityRecord({
    userId,
    pinHash,
    salt,
    enabled: true,
    createdAt: now,
    updatedAt: now,
    failCount: 0,
    lockedUntil: null,
  })
  touchActivity()
  markUnlockedNow()
  setSoftLocked(false)
  return { ok: true }
}

/**
 * Change PIN: requires current PIN proof (no silent reset).
 */
export async function changePin(
  userId: string,
  currentPin: string,
  newPin: string
): Promise<{ ok: true } | { ok: false; error: string; forcePiReauth?: boolean }> {
  const verified = await verifyPin(userId, currentPin)
  if (!verified.ok) {
    return verified
  }
  const result = await setupPin(userId, newPin)
  if (!result.ok) return result
  return { ok: true }
}

export async function verifyPin(
  userId: string,
  pin: string
): Promise<{ ok: true } | { ok: false; error: string; forcePiReauth?: boolean }> {
  const rec = loadSecurityRecord(userId)
  if (!rec?.enabled) {
    return { ok: false, error: "No PIN configured" }
  }
  if (rec.lockedUntil && Date.now() < rec.lockedUntil) {
    const secs = Math.ceil((rec.lockedUntil - Date.now()) / 1000)
    return {
      ok: false,
      error: `Too many attempts. Try again in ${secs}s or re-authenticate with Pi.`,
      forcePiReauth: rec.failCount >= MAX_PIN_FAILURES,
    }
  }
  const cleaned = String(pin || "").replace(/\D/g, "")
  const candidate = await hashPin(cleaned, rec.salt)
  if (candidate === rec.pinHash) {
    saveSecurityRecord({
      ...rec,
      failCount: 0,
      lockedUntil: null,
      updatedAt: Date.now(),
    })
    touchActivity()
    markUnlockedNow()
    setSoftLocked(false)
    return { ok: true }
  }
  const failCount = (rec.failCount || 0) + 1
  const forcePiReauth = failCount >= MAX_PIN_FAILURES
  // Progressive backoff: 15s, 30s, 45s, 60s, then longer + force Pi
  const backoffMs = forcePiReauth
    ? 120_000
    : Math.min(15_000 * failCount, 90_000)
  saveSecurityRecord({
    ...rec,
    failCount,
    lockedUntil: Date.now() + backoffMs,
    updatedAt: Date.now(),
  })
  if (forcePiReauth) {
    return {
      ok: false,
      error: "Too many incorrect PINs. Sign in again with Pi Network.",
      forcePiReauth: true,
    }
  }
  return {
    ok: false,
    error: `Incorrect PIN (${MAX_PIN_FAILURES - failCount} attempts left)`,
  }
}

export function clearPin(userId: string): void {
  if (typeof localStorage === "undefined" || !userId) return
  try {
    localStorage.removeItem(storageKey(userId))
  } catch {
    /* */
  }
}

/** Activity timestamp — localStorage so multi-tab share idle clock */
export function touchActivity(): void {
  if (typeof localStorage === "undefined") return
  try {
    localStorage.setItem(GLOBAL_LAST_ACTIVITY, String(Date.now()))
  } catch {
    /* */
  }
}

export function getLastActivity(): number {
  if (typeof localStorage === "undefined") return Date.now()
  try {
    const v = Number(localStorage.getItem(GLOBAL_LAST_ACTIVITY) || 0)
    return Number.isFinite(v) && v > 0 ? v : Date.now()
  } catch {
    return Date.now()
  }
}

export function isIdlePastLock(idleMs: number): boolean {
  return Date.now() - getLastActivity() >= idleMs
}

/**
 * Soft-lock flag in localStorage (shared across tabs).
 * Also writes LOCK_SYNC_KEY to notify other tabs via storage event.
 */
export function setSoftLocked(locked: boolean): void {
  if (typeof localStorage === "undefined") return
  try {
    if (locked) localStorage.setItem(LOCK_FLAG, "1")
    else localStorage.removeItem(LOCK_FLAG)
    // Notify other tabs (storage event only fires in *other* documents)
    localStorage.setItem(
      LOCK_SYNC_KEY,
      JSON.stringify({ locked, at: Date.now() })
    )
  } catch {
    /* */
  }
}

export function isSoftLocked(): boolean {
  if (typeof localStorage === "undefined") return false
  try {
    return localStorage.getItem(LOCK_FLAG) === "1"
  } catch {
    return false
  }
}

export function markUnlockedNow(): void {
  if (typeof localStorage === "undefined") return
  try {
    localStorage.setItem(LAST_UNLOCK_AT, String(Date.now()))
  } catch {
    /* */
  }
}

export function getLastUnlockAt(): number {
  if (typeof localStorage === "undefined") return 0
  try {
    return Number(localStorage.getItem(LAST_UNLOCK_AT) || 0) || 0
  } catch {
    return 0
  }
}

/**
 * Returning user with PIN: require lock unless recently unlocked within step-up window.
 * Prevents "valid GH session + refresh → unrestricted UI".
 */
export function shouldRequireLockOnResume(userId: string, idleMs: number): boolean {
  if (!userId || userId === "current-user") return false
  if (!hasPinConfigured(userId)) return false
  if (isSoftLocked()) return true
  if (isIdlePastLock(idleMs)) return true
  // Fresh unlock in this browser allows resume without re-prompt
  if (hasFreshStepUp(Math.max(STEP_UP_FRESH_MS, idleMs))) return false
  // PIN configured but no recent unlock evidence → lock
  return true
}

/** True if user unlocked recently enough for client step-up UX */
export function hasFreshStepUp(maxAgeMs: number = STEP_UP_FRESH_MS): boolean {
  const t = getLastUnlockAt()
  if (!t) return false
  return Date.now() - t <= maxAgeMs
}

/**
 * Client-only gate. Soft-locked always blocks.
 * Unlocked + recent unlock required for STEP_UP_ACTIONS when PIN is configured.
 * Does NOT grant server/financial authorization.
 */
export function canPerformSensitiveAction(
  action: SensitiveAction,
  opts?: { softLocked?: boolean; pinConfigured?: boolean }
): { allowed: boolean; reason?: "locked" | "step_up_required" | "ok" } {
  if (opts?.softLocked || isSoftLocked()) {
    return { allowed: false, reason: "locked" }
  }
  if (!STEP_UP_ACTIONS[action]) {
    return { allowed: true, reason: "ok" }
  }
  if (opts?.pinConfigured === false) {
    return { allowed: true, reason: "ok" }
  }
  if (!hasFreshStepUp()) {
    return { allowed: false, reason: "step_up_required" }
  }
  return { allowed: true, reason: "ok" }
}

/** Clear local lock state on logout (does not clear PIN hash) */
export function clearLockSessionState(): void {
  if (typeof localStorage === "undefined") return
  try {
    localStorage.removeItem(LOCK_FLAG)
    localStorage.removeItem(LAST_UNLOCK_AT)
    localStorage.removeItem(GLOBAL_LAST_ACTIVITY)
    localStorage.setItem(
      LOCK_SYNC_KEY,
      JSON.stringify({ locked: false, at: Date.now(), logout: true })
    )
  } catch {
    /* */
  }
}

/** Detect platform authenticator (future passkey path — not implemented) */
export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  try {
    if (typeof window === "undefined" || !window.PublicKeyCredential) return false
    const fn =
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable
    if (typeof fn !== "function") return false
    return await fn.call(PublicKeyCredential)
  } catch {
    return false
  }
}
