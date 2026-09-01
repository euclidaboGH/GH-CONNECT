/**
 * IdentityService — single source of truth for session identity.
 *
 * Production chain:
 *   Pi UID (verified access token on server)
 *     → GreenHaven user ID (same string as Pi UID when linked)
 *       → Profile / GHC account / Wallet
 *
 * Studio/local may use "current-user" only when no Pi UID is available.
 * Never treat "current-user" as a production wallet or transfer party.
 */

export const LOCAL_STUDIO_USER_ID = "current-user" as const

export type AuthState =
  | "unknown"
  | "anonymous"
  | "authenticated"
  | "error"

export type VerificationState =
  | "unverified"
  | "pi_linked"
  | "server_verified"

export type AccountStatus =
  | "setup"
  | "active"
  | "restricted"
  | "suspended"

export interface SessionIdentity {
  /** Canonical app user id — prefer Pi UID */
  userId: string
  piUserId: string | null
  username: string | null
  displayName: string | null
  accessToken: string | null
  authState: AuthState
  verificationState: VerificationState
  accountStatus: AccountStatus
  /** true when userId is only a local studio placeholder */
  isLocalStudioId: boolean
  updatedAt: number
}

type Listener = (identity: SessionIdentity) => void

const defaultIdentity = (): SessionIdentity => ({
  userId: LOCAL_STUDIO_USER_ID,
  piUserId: null,
  username: null,
  displayName: null,
  accessToken: null,
  authState: "unknown",
  verificationState: "unverified",
  accountStatus: "setup",
  isLocalStudioId: true,
  updatedAt: Date.now(),
})

let identity: SessionIdentity = defaultIdentity()
const listeners = new Set<Listener>()

function emit() {
  const snap = { ...identity }
  listeners.forEach((l) => {
    try {
      l(snap)
    } catch {
      /* */
    }
  })
}

/**
 * Resolve the canonical user id from available signals.
 * Order: Pi UID → explicit profile id → local studio fallback.
 */
export function resolveCanonicalUserId(input?: {
  piUid?: string | null
  profileUserId?: string | null
  explicitUserId?: string | null
}): string {
  const candidates = [
    input?.explicitUserId,
    input?.piUid,
    input?.profileUserId,
  ]
  for (const c of candidates) {
    const id = String(c || "").trim()
    if (id && id !== LOCAL_STUDIO_USER_ID && id !== "preview-user" && id !== "app-studio-user") {
      return id
    }
  }
  return LOCAL_STUDIO_USER_ID
}

export function isStudioPlaceholderId(userId: string | null | undefined): boolean {
  const id = String(userId || "").trim()
  return (
    !id ||
    id === LOCAL_STUDIO_USER_ID ||
    id === "preview-user" ||
    id === "app-studio-user"
  )
}

export const IdentityService = {
  getIdentity(): SessionIdentity {
    return { ...identity }
  },

  getCurrentUserId(): string {
    return identity.userId
  },

  getPiUserId(): string | null {
    return identity.piUserId
  },

  getUsername(): string | null {
    return identity.username
  },

  getAccessToken(): string | null {
    return identity.accessToken
  },

  getAuthState(): AuthState {
    return identity.authState
  },

  getVerificationState(): VerificationState {
    return identity.verificationState
  },

  getAccountStatus(): AccountStatus {
    return identity.accountStatus
  },

  isProductionIdentity(): boolean {
    return !identity.isLocalStudioId && Boolean(identity.piUserId)
  },

  /**
   * Apply identity from Pi login / App Studio / profile hydration.
   * Prefer Pi UID as the permanent userId when present.
   */
  setFromPi(input: {
    uid?: string | null
    username?: string | null
    displayName?: string | null
    accessToken?: string | null
    verifiedByServer?: boolean
  }): SessionIdentity {
    const piUid = String(input.uid || "").trim() || null
    const userId = resolveCanonicalUserId({
      piUid,
      explicitUserId: identity.userId !== LOCAL_STUDIO_USER_ID ? identity.userId : null,
    })

    identity = {
      ...identity,
      userId,
      piUserId: piUid,
      username: input.username?.trim() || identity.username,
      displayName: input.displayName?.trim() || identity.displayName,
      accessToken: input.accessToken?.trim() || identity.accessToken,
      authState: piUid || input.accessToken ? "authenticated" : identity.authState,
      verificationState: input.verifiedByServer
        ? "server_verified"
        : piUid
          ? "pi_linked"
          : identity.verificationState,
      accountStatus: identity.accountStatus === "setup" && piUid ? "active" : identity.accountStatus,
      isLocalStudioId: isStudioPlaceholderId(userId),
      updatedAt: Date.now(),
    }
    emit()
    return this.getIdentity()
  },

  setAuthState(authState: AuthState) {
    identity = { ...identity, authState, updatedAt: Date.now() }
    emit()
  },

  setAccountStatus(accountStatus: AccountStatus) {
    identity = { ...identity, accountStatus, updatedAt: Date.now() }
    emit()
  },

  /** Clear session identity (logout / hard reset) */
  clear() {
    identity = defaultIdentity()
    emit()
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },

  /** Headers for server economy / API calls */
  getAuthHeaders(): Record<string, string> {
    const token = identity.accessToken
    if (token) {
      return { Authorization: `Bearer ${token}` }
    }
    // Dev / memory-ledger path when server allows GHC_ALLOW_DEV_AUTH
    // Includes studio placeholder so local spend/claim can authenticate in development
    if (identity.userId) {
      return { Authorization: `Bearer user:${identity.userId}` }
    }
    return {}
  },
}

export type IdentityServiceApi = typeof IdentityService
