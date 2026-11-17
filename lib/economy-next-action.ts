export type EconomyNextActionInput = {
  availableGhc: number
  pendingGhc: number
  lockedGhc: number
  claimableToday: boolean
  selectedRail: "ghc" | "pi"
}

export type EconomyNextAction = {
  id: "pending" | "claim" | "pi" | "activity" | "rewards"
  kicker: string
  title: string
  detail: string
  cta: string
}

export function resolveEconomyNextAction(input: EconomyNextActionInput): EconomyNextAction {
  if (input.pendingGhc > 0 || input.lockedGhc > 0) {
    return {
      id: "pending",
      kicker: "Funds need attention",
      title: "Review pending and reserved GHC",
      detail: "See what is still maturing, validating, or reserved before planning a transfer or purchase.",
      cta: "Review funds",
    }
  }
  if (input.claimableToday) {
    return {
      id: "claim",
      kicker: "Available action",
      title: "Your Daily Claim is available",
      detail: "Open Rewards to complete the available claim. Wallet will only show the ledger effect after server confirmation.",
      cta: "Open Rewards",
    }
  }
  if (input.selectedRail === "pi") {
    return {
      id: "pi",
      kicker: "Pi rail selected",
      title: "Review Pi earnings and cashback",
      detail: "Pi stays separate from GHC. Review eligible earnings, cashback, and payout tools on the Pi rail.",
      cta: "View Pi tools",
    }
  }
  if (input.availableGhc > 0) {
    return {
      id: "activity",
      kicker: "Wallet ready",
      title: "Your available GHC is ready for utility",
      detail: "Review activity or use the available balance through supported GreenHaven utility. Pending and reserved funds remain separate.",
      cta: "View activity",
    }
  }
  return {
    id: "rewards",
    kicker: "Build participation",
    title: "Explore legitimate GreenHaven opportunities",
    detail: "Rewards and opportunities are based on funded, validated ecosystem activity—not promised income or passive returns.",
    cta: "Explore Rewards",
  }
}
