"use client"

/**
 * Profile domain store surface.
 * Thin selector over GHC context — first step away from the god context.
 */

import { useMemo } from "react"
import { useGHC } from "@/contexts/ghc-context"

export function useProfileDomain() {
  const ctx = useGHC()

  return useMemo(
    () => ({
      ready: ctx.ready,
      profile: ctx.profile,
      settings: ctx.settings,
      localProfiles: ctx.localProfiles,
      updateProfile: ctx.updateProfile,
      completeOnboarding: ctx.completeOnboarding,
      updateSettings: ctx.updateSettings,
      switchLocalProfile: ctx.switchLocalProfile,
      createLocalProfile: ctx.createLocalProfile,
      canViewProfile: ctx.canViewProfile,
      logout: ctx.logout,
    }),
    [
      ctx.ready,
      ctx.profile,
      ctx.settings,
      ctx.localProfiles,
      ctx.updateProfile,
      ctx.completeOnboarding,
      ctx.updateSettings,
      ctx.switchLocalProfile,
      ctx.createLocalProfile,
      ctx.canViewProfile,
      ctx.logout,
    ]
  )
}
