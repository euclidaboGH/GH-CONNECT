"use client"

/**
 * Local App Lock provider (UI presence).
 * Distinct from GH server session (Phase 2B HttpOnly cookie).
 * Locked UI ≠ logged out. Unlocked UI ≠ financial authorization.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { IdentityService } from "@/lib/identity/identity-service"
import {
  canPerformSensitiveAction,
  changePin,
  clearLockSessionState,
  getLockPolicy,
  hasPinConfigured,
  isIdlePastLock,
  isSoftLocked,
  LOCK_POLICIES,
  LOCK_SYNC_KEY,
  shouldRequireLockOnResume,
  type AppSecurityState,
  type LockPolicyId,
  type SensitiveAction,
  setLockPolicy,
  setSoftLocked,
  setupPin,
  touchActivity,
  verifyPin,
  type LockPolicy,
} from "@/lib/session-security"
import { usePiAuth } from "@/contexts/pi-auth-context"

type SessionLockContextValue = {
  isLocked: boolean
  securityState: AppSecurityState
  pinConfigured: boolean
  needsPinSetup: boolean
  policy: LockPolicy
  idleLockMs: number
  lockNow: () => void
  unlockWithPin: (pin: string) => Promise<{ ok: boolean; error?: string; forcePiReauth?: boolean }>
  configurePin: (pin: string) => Promise<{ ok: boolean; error?: string }>
  changeDevicePin: (
    currentPin: string,
    newPin: string
  ) => Promise<{ ok: boolean; error?: string; forcePiReauth?: boolean }>
  skipPinSetupForNow: () => void
  markActivity: () => void
  setPolicy: (id: LockPolicyId) => void
  ensureStepUp: (action: SensitiveAction) => { ok: boolean; reason?: string }
  onServerSessionInvalid: (kind: "expired" | "revoked") => void
}

const SessionLockContext = createContext<SessionLockContextValue | null>(null)

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  "pointerdown",
  "keydown",
  "touchstart",
  "scroll",
]

export function SessionLockProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, reinitialize } = usePiAuth()
  const [userId, setUserId] = useState(() => IdentityService.getCurrentUserId())
  const [isLocked, setIsLocked] = useState(false)
  const [securityState, setSecurityState] = useState<AppSecurityState>("ACTIVE")
  const [pinConfigured, setPinConfigured] = useState(false)
  const [needsPinSetup, setNeedsPinSetup] = useState(false)
  const [pinSetupSkipped, setPinSetupSkipped] = useState(false)
  const [policy, setPolicyState] = useState<LockPolicy>(() =>
    getLockPolicy(IdentityService.getCurrentUserId())
  )
  const backgroundedAt = useRef<number | null>(null)

  useEffect(() => {
    return IdentityService.subscribe((id) => {
      setUserId(id.userId)
      setPolicyState(getLockPolicy(id.userId))
    })
  }, [])

  useEffect(() => {
    if (!userId || userId === "current-user") {
      setPinConfigured(false)
      setNeedsPinSetup(false)
      return
    }
    const has = hasPinConfigured(userId)
    setPinConfigured(has)
    if (isAuthenticated && !has && !pinSetupSkipped) {
      setNeedsPinSetup(true)
    }
  }, [userId, isAuthenticated, pinSetupSkipped])

  // On auth: require lock for returning users with PIN (do not auto-grant UI)
  useEffect(() => {
    if (!isAuthenticated) {
      setSecurityState("SIGNED_OUT")
      setIsLocked(false)
      return
    }
    const uid = IdentityService.getCurrentUserId()
    const pol = getLockPolicy(uid)
    if (shouldRequireLockOnResume(uid, pol.idleLockMs)) {
      setSoftLocked(true)
      setIsLocked(true)
      setSecurityState("LOCKED")
    } else {
      touchActivity()
      setSecurityState("ACTIVE")
    }
  }, [isAuthenticated, policy.idleLockMs])

  // Multi-tab lock sync via localStorage storage event
  useEffect(() => {
    const onStorage = (ev: StorageEvent) => {
      if (ev.key === LOCK_SYNC_KEY || ev.key === "gh_session_soft_locked_v1") {
        if (isSoftLocked()) {
          setIsLocked(true)
          setSecurityState("LOCKED")
        } else if (ev.key === LOCK_SYNC_KEY) {
          try {
            const data = JSON.parse(ev.newValue || "{}") as {
              locked?: boolean
              logout?: boolean
            }
            if (data.logout) {
              setIsLocked(false)
              setSecurityState("SIGNED_OUT")
              return
            }
            if (data.locked === false) {
              setIsLocked(false)
              setSecurityState("ACTIVE")
            } else if (data.locked === true) {
              setIsLocked(true)
              setSecurityState("LOCKED")
            }
          } catch {
            /* */
          }
        }
      }
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  // External step-up requests (e.g. GH Pay before payment — UI only)
  useEffect(() => {
    const onReq = () => {
      setSoftLocked(true)
      setIsLocked(true)
      setSecurityState("LOCKED")
    }
    window.addEventListener("ghc:security-lock-required", onReq)
    return () => window.removeEventListener("ghc:security-lock-required", onReq)
  }, [])

  const markActivity = useCallback(() => {
    if (isLocked) return
    touchActivity()
  }, [isLocked])

  const lockNow = useCallback(() => {
    setSoftLocked(true)
    setIsLocked(true)
    setSecurityState("LOCKED")
  }, [])

  const onServerSessionInvalid = useCallback((kind: "expired" | "revoked") => {
    setIsLocked(true)
    setSecurityState(kind === "revoked" ? "SESSION_REVOKED" : "SESSION_EXPIRED")
  }, [])

  const setPolicy = useCallback((id: LockPolicyId) => {
    const uid = IdentityService.getCurrentUserId()
    setLockPolicy(uid, id)
    setPolicyState(LOCK_POLICIES[id])
  }, [])

  useEffect(() => {
    if (!isAuthenticated || isLocked) return

    const onActivity = () => markActivity()
    for (const ev of ACTIVITY_EVENTS) {
      window.addEventListener(ev, onActivity, { passive: true })
    }

    const interval = window.setInterval(() => {
      if (document.visibilityState === "hidden") {
        if (backgroundedAt.current == null) backgroundedAt.current = Date.now()
        const leftAt = backgroundedAt.current
        if (
          policy.lockOnBackground &&
          leftAt != null &&
          Date.now() - leftAt >= policy.backgroundGraceMs
        ) {
          lockNow()
        }
        return
      }
      backgroundedAt.current = null
      if (isIdlePastLock(policy.idleLockMs)) {
        lockNow()
      }
    }, 5_000)

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        backgroundedAt.current = Date.now()
        if (policy.lockOnBackground && policy.backgroundGraceMs === 0) {
          lockNow()
        }
      } else {
        const leftAt = backgroundedAt.current
        backgroundedAt.current = null
        if (
          policy.lockOnBackground &&
          leftAt != null &&
          Date.now() - leftAt >= policy.backgroundGraceMs
        ) {
          lockNow()
          return
        }
        if (isIdlePastLock(policy.idleLockMs)) {
          lockNow()
        } else {
          markActivity()
        }
      }
    }
    document.addEventListener("visibilitychange", onVisibility)

    // pagehide is more reliable on mobile than visibility alone
    const onPageHide = () => {
      backgroundedAt.current = Date.now()
      if (policy.lockOnBackground && policy.backgroundGraceMs === 0) {
        lockNow()
      }
    }
    window.addEventListener("pagehide", onPageHide)

    return () => {
      for (const ev of ACTIVITY_EVENTS) {
        window.removeEventListener(ev, onActivity)
      }
      window.clearInterval(interval)
      document.removeEventListener("visibilitychange", onVisibility)
      window.removeEventListener("pagehide", onPageHide)
    }
  }, [isAuthenticated, isLocked, policy, markActivity, lockNow])

  const unlockWithPin = useCallback(
    async (pin: string) => {
      setSecurityState("AUTHENTICATING")
      const uid = IdentityService.getCurrentUserId()
      if (!hasPinConfigured(uid)) {
        setSecurityState("REAUTH_REQUIRED")
        return { ok: false, error: "No PIN set. Use Pi sign-in.", forcePiReauth: true }
      }
      const result = await verifyPin(uid, pin)
      if (result.ok) {
        setSoftLocked(false)
        setIsLocked(false)
        setSecurityState("ACTIVE")
        touchActivity()
        return { ok: true }
      }
      if (result.forcePiReauth) {
        // Stay locked until Pi reauth completes — do not unlock UI
        setSecurityState("REAUTH_REQUIRED")
        setSoftLocked(true)
        setIsLocked(true)
        try {
          clearLockSessionState()
          IdentityService.clear()
        } catch {
          /* */
        }
        void reinitialize()
      } else {
        setSecurityState("LOCKED")
      }
      return {
        ok: false,
        error: result.error,
        forcePiReauth: result.forcePiReauth,
      }
    },
    [reinitialize]
  )

  const configurePin = useCallback(async (pin: string) => {
    const uid = IdentityService.getCurrentUserId()
    const result = await setupPin(uid, pin)
    if (result.ok) {
      setPinConfigured(true)
      setNeedsPinSetup(false)
      setPinSetupSkipped(false)
      setIsLocked(false)
      setSecurityState("ACTIVE")
      touchActivity()
    }
    return result
  }, [])

  const changeDevicePin = useCallback(
    async (currentPin: string, newPin: string) => {
      const uid = IdentityService.getCurrentUserId()
      const result = await changePin(uid, currentPin, newPin)
      return result
    },
    []
  )

  const skipPinSetupForNow = useCallback(() => {
    setPinSetupSkipped(true)
    setNeedsPinSetup(false)
  }, [])

  const ensureStepUp = useCallback(
    (action: SensitiveAction) => {
      const check = canPerformSensitiveAction(action, {
        softLocked: isLocked,
        pinConfigured,
      })
      if (check.allowed) return { ok: true }
      if (check.reason === "locked" || check.reason === "step_up_required") {
        lockNow()
        return { ok: false, reason: check.reason }
      }
      return { ok: false, reason: check.reason }
    },
    [isLocked, pinConfigured, lockNow]
  )

  const value = useMemo<SessionLockContextValue>(
    () => ({
      isLocked,
      securityState,
      pinConfigured,
      needsPinSetup,
      policy,
      idleLockMs: policy.idleLockMs,
      lockNow,
      unlockWithPin,
      configurePin,
      changeDevicePin,
      skipPinSetupForNow,
      markActivity,
      setPolicy,
      ensureStepUp,
      onServerSessionInvalid,
    }),
    [
      isLocked,
      securityState,
      pinConfigured,
      needsPinSetup,
      policy,
      lockNow,
      unlockWithPin,
      configurePin,
      changeDevicePin,
      skipPinSetupForNow,
      markActivity,
      setPolicy,
      ensureStepUp,
      onServerSessionInvalid,
    ]
  )

  return (
    <SessionLockContext.Provider value={value}>{children}</SessionLockContext.Provider>
  )
}

export function useSessionLock(): SessionLockContextValue {
  const ctx = useContext(SessionLockContext)
  if (!ctx) {
    return {
      isLocked: false,
      securityState: "ACTIVE",
      pinConfigured: false,
      needsPinSetup: false,
      policy: LOCK_POLICIES.balanced,
      idleLockMs: LOCK_POLICIES.balanced.idleLockMs,
      lockNow: () => {},
      unlockWithPin: async () => ({ ok: false, error: "unavailable" }),
      configurePin: async () => ({ ok: false, error: "unavailable" }),
      changeDevicePin: async () => ({ ok: false, error: "unavailable" }),
      skipPinSetupForNow: () => {},
      markActivity: () => {},
      setPolicy: () => {},
      ensureStepUp: () => ({ ok: true }),
      onServerSessionInvalid: () => {},
    }
  }
  return ctx
}
