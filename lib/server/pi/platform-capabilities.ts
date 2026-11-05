/**
 * Honest Pi platform capability matrix for GreenHaven.
 * Never claims access to data Pi does not expose to this app.
 */

export type CapabilityStatus = "live" | "configured" | "unavailable" | "not_integrated"

export type PlatformCapability = {
  id: string
  title: string
  status: CapabilityStatus
  detail: string
  engagementOnly?: boolean
}

export function buildPlatformCapabilities(): {
  environment: "sandbox" | "production" | "unknown"
  capabilities: PlatformCapability[]
  principles: string[]
} {
  const piEnv = String(process.env.PI_ENV || "").toLowerCase()
  const publicSandbox = String(process.env.NEXT_PUBLIC_PI_SANDBOX || "").toLowerCase()
  let environment: "sandbox" | "production" | "unknown" = "unknown"
  if (piEnv === "production" || publicSandbox === "false") environment = "production"
  else if (piEnv === "sandbox" || publicSandbox === "true") environment = "sandbox"

  const hasApiKey = Boolean(String(process.env.PI_API_KEY || "").trim())
  const stakingFlag =
    process.env.PI_STAKING_API_ENABLED === "true" || process.env.PI_STAKING_API_ENABLED === "1"
  const piOnly = String(process.env.GHC_PI_ONLY_COMMERCE ?? "1").trim() !== "0"

  const capabilities: PlatformCapability[] = [
    {
      id: "auth_me",
      title: "Pi authentication (/v2/me)",
      status: hasApiKey ? "configured" : "unavailable",
      detail: hasApiKey
        ? "Server verifies access tokens via Pi Platform; uid is app-specific."
        : "Set PI_API_KEY for server-side /v2/me verification.",
    },
    {
      id: "payments",
      title: "Pi payments (U2A)",
      status: hasApiKey ? "configured" : "unavailable",
      detail:
        "Payment intents use approve/complete with durable server state. Separate from GHC ledger.",
    },
    {
      id: "identity_map",
      title: "Trusted Pioneer mapping",
      status: "live",
      detail:
        "gh_pi_identities links verified pi_app_uid to GreenHaven user; badge only after server verify.",
    },
    {
      id: "commerce_rail",
      title: "Commerce fee rail",
      status: "live",
      detail: piOnly
        ? "Pi-only fees for listing/community (GHC earn-only: claim, referral, missions)."
        : "Dual-rail fees enabled — review before mainnet listing.",
    },
    {
      id: "staking",
      title: "Directory staking data",
      status: stakingFlag ? "configured" : "unavailable",
      engagementOnly: true,
      detail:
        "Optional product signal only. Never a wallet balance, never payment authority, never legal identity.",
    },
    {
      id: "in_app_notifications",
      title: "Pi native in-app notifications",
      status: "not_integrated",
      detail:
        "Scope depends on Pi Platform allow-list. GreenHaven uses its own notification centre until official API access is confirmed.",
    },
    {
      id: "piverify",
      title: "PiVerify / KYC",
      status: "not_integrated",
      detail: "No integration. Consent UX will precede any future eligibility.",
    },
    {
      id: "social_import",
      title: "Pi social graph / DMs",
      status: "unavailable",
      detail:
        "Pi does not expose other users private social graphs to third-party apps. GreenHaven owns messaging and communities.",
    },
  ]

  return {
    environment,
    capabilities,
    principles: [
      "Pi authentication + wallet + payments + optional signals + GreenHaven social DB.",
      "Do not invent balances, KYC, or social data Pi does not return.",
      "Source readiness is not the same as production or mainnet evidence.",
    ],
  }
}
