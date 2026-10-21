/**
 * Client-safe economy program status.
 * Never enables issuance — only reports configured public flags.
 * Settlement remains server-authoritative and flag-gated.
 */
export type EconomyProgramId =
  | "daily_claim"
  | "referral_settlement"
  | "curation_redistribute"
  | "membership_spend"
  | "marketplace_fees"

export type EconomyProgramRow = {
  id: EconomyProgramId
  title: string
  summary: string
  surfaceLive: boolean
  issuanceEnabled: boolean
  mode: "issue" | "redistribute" | "spend" | "utility"
}

function envFlag(name: string): boolean {
  try {
    const v = String(process.env[name] || "").trim().toLowerCase()
    return v === "1" || v === "true" || v === "yes"
  } catch {
    return false
  }
}

export function getEconomyProgramStatus(): EconomyProgramRow[] {
  const referral =
    envFlag("NEXT_PUBLIC_GHC_REFERRAL_SETTLEMENT_ENABLED") ||
    envFlag("GHC_REFERRAL_SETTLEMENT_ENABLED")
  const curation =
    envFlag("NEXT_PUBLIC_GHC_CURATION_REDISTRIBUTE_ENABLED") ||
    envFlag("GHC_CURATION_REDISTRIBUTE_ENABLED")

  return [
    {
      id: "daily_claim",
      title: "Daily Claim",
      summary: "Lagos-midnight claim with 48h lock when migrations are applied.",
      surfaceLive: true,
      issuanceEnabled: true,
      mode: "issue",
    },
    {
      id: "referral_settlement",
      title: "Referral rewards",
      summary: "5% of charged membership — on when referral flag or testnet unlock.",
      surfaceLive: true,
      issuanceEnabled: referral,
      mode: "issue",
    },
    {
      id: "curation_redistribute",
      title: "Curation rewards",
      summary: "Redistributes existing GHC. On when GHC_CURATION_REDISTRIBUTE_ENABLED or testnet unlock.",
      surfaceLive: true,
      issuanceEnabled: curation,
      mode: "redistribute",
    },
    {
      id: "membership_spend",
      title: "Membership",
      summary: "VIP/VVIP purchase spends GHC or Pi — no new GHC issuance.",
      surfaceLive: true,
      issuanceEnabled: false,
      mode: "spend",
    },
    {
      id: "marketplace_fees",
      title: "Marketplace fees",
      summary: "Listing/order fees consume GHC or Pi when configured.",
      surfaceLive: true,
      issuanceEnabled: false,
      mode: "utility",
    },
  ]
}

export function formatProgramBadge(row: EconomyProgramRow): string {
  if (row.mode === "spend" || row.mode === "utility") return "Spend / utility"
  if (row.issuanceEnabled) return row.mode === "redistribute" ? "Redistribute ON" : "Issuance ON"
  return row.mode === "redistribute" ? "Redistribute OFF" : "Issuance OFF"
}
