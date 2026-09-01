"use client"

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import {
  IdentityService,
  type SessionIdentity,
  type AuthState,
  type VerificationState,
  type AccountStatus,
} from "@/lib/identity/identity-service"

export interface IdentityContextValue {
  identity: SessionIdentity
  getCurrentUserId: () => string
  getPiUserId: () => string | null
  getUsername: () => string | null
  getAuthState: () => AuthState
  getVerificationState: () => VerificationState
  getAccountStatus: () => AccountStatus
  isProductionIdentity: () => boolean
  getAuthHeaders: () => Record<string, string>
}

const IdentityContext = createContext<IdentityContextValue | null>(null)

export function IdentityProvider({ children }: { children: ReactNode }) {
  const [identity, setIdentity] = useState<SessionIdentity>(() =>
    IdentityService.getIdentity()
  )

  useEffect(() => {
    return IdentityService.subscribe((next) => setIdentity(next))
  }, [])

  const value = useMemo<IdentityContextValue>(
    () => ({
      identity,
      getCurrentUserId: () => IdentityService.getCurrentUserId(),
      getPiUserId: () => IdentityService.getPiUserId(),
      getUsername: () => IdentityService.getUsername(),
      getAuthState: () => IdentityService.getAuthState(),
      getVerificationState: () => IdentityService.getVerificationState(),
      getAccountStatus: () => IdentityService.getAccountStatus(),
      isProductionIdentity: () => IdentityService.isProductionIdentity(),
      getAuthHeaders: () => IdentityService.getAuthHeaders(),
    }),
    [identity]
  )

  return (
    <IdentityContext.Provider value={value}>{children}</IdentityContext.Provider>
  )
}

export function useIdentity(): IdentityContextValue {
  const ctx = useContext(IdentityContext)
  if (!ctx) {
    // Safe fallback for modules mounted outside provider (tests / early boot)
    return {
      identity: IdentityService.getIdentity(),
      getCurrentUserId: () => IdentityService.getCurrentUserId(),
      getPiUserId: () => IdentityService.getPiUserId(),
      getUsername: () => IdentityService.getUsername(),
      getAuthState: () => IdentityService.getAuthState(),
      getVerificationState: () => IdentityService.getVerificationState(),
      getAccountStatus: () => IdentityService.getAccountStatus(),
      isProductionIdentity: () => IdentityService.isProductionIdentity(),
      getAuthHeaders: () => IdentityService.getAuthHeaders(),
    }
  }
  return ctx
}
