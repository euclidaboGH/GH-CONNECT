"use client"

/**
 * Compatibility re-export for Settings and legacy imports.
 * Relative path — App Studio often fails on @/features aliases.
 */
export { PremiumWalletScreen } from "../../features/wallet/wallet-screen"
export { PremiumWalletScreen as default } from "../../features/wallet/wallet-screen"
