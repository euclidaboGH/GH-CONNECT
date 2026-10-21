/**
 * Public, read-only description of the currently configured GHC utility economy.
 * This module must never mint, debit, settle, or mutate ledger state.
 */
import {
  CLAIM_GROSS_BY_DAY,
  CLAIM_USER_SHARE,
  ECONOMY_VERSION,
  REFERENCE_GHC_PER_PI,
} from "@/lib/server/economy/economic-config"
import { listPublicSpendCatalog } from "@/lib/server/economy/spend-catalog"
import { areGhcPiWithdrawalsEnabled } from "@/lib/server/economy/withdrawal"

export function getPublicGhcEconomyPolicy() {
  return {
    version: ECONOMY_VERSION,
    asset: {
      symbol: "GHC",
      name: "GreenHaven Coin",
      classification: "in_app_utility_balance",
      externalRedemptionPromised: false,
      piToGhcPurchaseAvailable: false,
      piToGhcPurchaseNote: "Pi-funded GHC packs are unavailable until a non-empty approved pack catalog and durable ledger-credit settlement are implemented and tested.",
      ghcToPiWithdrawalFeatureFlagEnabled: areGhcPiWithdrawalsEnabled(),
      referenceGhcPerPi: REFERENCE_GHC_PER_PI,
      referenceRateDisclaimer: "Internal reference benchmark only. It is not a market price, conversion offer, guaranteed value, or redemption promise.",
    },
    issuance: {
      mode: "server_authoritative_daily_claim_only",
      dailyClaimBaseGrossGhc: [...CLAIM_GROSS_BY_DAY],
      userSharePercent: CLAIM_USER_SHARE * 100,
      note: "Daily figures are base gross values before network-scarcity controls and server eligibility checks; they are not guaranteed payouts. Generic activity issuance is locked by policy.",
    },
    uses: [
      { id: "peer_transfers", label: "In-app peer transfers", status: "implemented" },
      { id: "membership", label: "Eligible memberships", status: "catalog_priced" },
      { id: "boosts", label: "Eligible profile and post boosts", status: "catalog_priced" },
      { id: "marketplace", label: "Marketplace orders", status: "order_bound" },
    ],
    fixedSpendCatalog: listPublicSpendCatalog(),
    safety: {
      clientMinting: false,
      clientAuthoritativePrices: false,
      pendingFundsSpendable: false,
      ledgerIsBalanceAuthority: true,
      withdrawalsDefaultOff: !areGhcPiWithdrawalsEnabled(),
      piPaymentsAndGhcLedgerSeparate: true,
    },
  } as const
}
