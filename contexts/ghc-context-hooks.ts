"use client"

/**
 * Stable re-export surface for GHC hooks (Phase 4).
 * Implementation remains with the provider module to avoid circular imports.
 */
export {
  useGHC,
  useGHCShell,
  useGHCProfile,
  useGHCDiscovery,
  useGHCMessaging,
  useGHCFeed,
  useGHCCommunity,
} from "./ghc-context"
