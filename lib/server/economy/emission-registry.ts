/**
 * ECONOMY_VERSION 1.2 — GHC emission channel registry (audit map).
 * Not a runtime router; documents each pathway and its current policy status.
 * Phase 6: only daily_claim may issue new user GHC. Activity, achievement,
 * referral, onboarding, community, challenge, marketplace reward, promotion,
 * admin credit and purchase credit are disabled. Transfers are redistribution.
 */

export type EmissionChannelId =
  | "daily_claim"
  | "activity_reward"
  | "achievement"
  | "referral"
  | "onboarding"
  | "community"
  | "challenge"
  | "marketplace_reward"
  | "promotion"
  | "admin_credit"
  | "purchase_credit"
  | "transfer_in"
  | "peer_request_accept"

export type EmissionChannelSpec = {
  id: EmissionChannelId
  /** Current Phase 6 policy: enabled issuance, disabled issuance, or redistribution. */
  policyStatus: "enabled_issuance" | "disabled_issuance" | "redistribution"
  description: string
  /** Server path that authorizes the credit */
  serverPath: string
  /** Applies Curve E × global governor */
  usesNetworkScarcity: boolean
  /** Applies activity pre-control caps (0.5/day, 2.5/week) */
  usesActivityCaps: boolean
  /** 80/20 protocol reserve split (claims only) */
  usesClaimReserveSplit: boolean
  clientCanSetAmount: boolean
  idempotent: boolean
  ledgerAuthoritative: boolean
}

export const EMISSION_CHANNELS: readonly EmissionChannelSpec[] = [
  {
    id: "daily_claim",
    policyStatus: "enabled_issuance",
    description: "7-day progressive daily claim",
    serverPath: "POST /api/economy/rewards/daily → ghc_execute_daily_claim_v12",
    usesNetworkScarcity: true,
    usesActivityCaps: false,
    usesClaimReserveSplit: true,
    clientCanSetAmount: false,
    idempotent: true,
    ledgerAuthoritative: true,
  },
  {
    id: "activity_reward",
    policyStatus: "disabled_issuance",
    description: "Social / creator activity via reward rules",
    serverPath: "POST /api/economy/rewards/evaluate → evaluateRewardAuthoritative + activity-emission",
    usesNetworkScarcity: true,
    usesActivityCaps: true,
    usesClaimReserveSplit: false,
    clientCanSetAmount: false,
    idempotent: true,
    ledgerAuthoritative: true,
  },
  {
    id: "achievement",
    policyStatus: "disabled_issuance",
    description: "ACHIEVEMENT_UNLOCKED / verified achievements",
    serverPath: "evaluateRewardAuthoritative (sourceEvent ACHIEVEMENT_UNLOCKED)",
    usesNetworkScarcity: true,
    usesActivityCaps: true,
    usesClaimReserveSplit: false,
    clientCanSetAmount: false,
    idempotent: true,
    ledgerAuthoritative: true,
  },
  {
    id: "referral",
    policyStatus: "disabled_issuance",
    description: "REFERRAL_VERIFIED",
    serverPath: "evaluateRewardAuthoritative",
    usesNetworkScarcity: true,
    usesActivityCaps: true,
    usesClaimReserveSplit: false,
    clientCanSetAmount: false,
    idempotent: true,
    ledgerAuthoritative: true,
  },
  {
    id: "onboarding",
    policyStatus: "disabled_issuance",
    description: "ONBOARDING_COMPLETED profile completion",
    serverPath: "evaluateRewardAuthoritative",
    usesNetworkScarcity: true,
    usesActivityCaps: true,
    usesClaimReserveSplit: false,
    clientCanSetAmount: false,
    idempotent: true,
    ledgerAuthoritative: true,
  },
  {
    id: "community",
    policyStatus: "disabled_issuance",
    description: "GROUP_JOINED / COMMUNITY_ROLE_CHANGED",
    serverPath: "evaluateRewardAuthoritative",
    usesNetworkScarcity: true,
    usesActivityCaps: true,
    usesClaimReserveSplit: false,
    clientCanSetAmount: false,
    idempotent: true,
    ledgerAuthoritative: true,
  },
  {
    id: "challenge",
    policyStatus: "disabled_issuance",
    description: "CHALLENGE_COMPLETED",
    serverPath: "evaluateRewardAuthoritative",
    usesNetworkScarcity: true,
    usesActivityCaps: true,
    usesClaimReserveSplit: false,
    clientCanSetAmount: false,
    idempotent: true,
    ledgerAuthoritative: true,
  },
  {
    id: "marketplace_reward",
    policyStatus: "disabled_issuance",
    description: "MARKETPLACE_ORDER_COMPLETED seller/activity credit",
    serverPath: "evaluateRewardAuthoritative",
    usesNetworkScarcity: true,
    usesActivityCaps: true,
    usesClaimReserveSplit: false,
    clientCanSetAmount: false,
    idempotent: true,
    ledgerAuthoritative: true,
  },
  {
    id: "promotion",
    policyStatus: "disabled_issuance",
    description: "Campaign / promo grants",
    serverPath: "admin credit or controlled evaluate sourceEvent",
    usesNetworkScarcity: false,
    usesActivityCaps: false,
    usesClaimReserveSplit: false,
    clientCanSetAmount: false,
    idempotent: true,
    ledgerAuthoritative: true,
  },
  {
    id: "admin_credit",
    policyStatus: "disabled_issuance",
    description: "Privileged adjusted credit",
    serverPath: "POST /api/economy/ledger/credit (GHC_ADMIN_CREDIT_KEY required)",
    usesNetworkScarcity: false,
    usesActivityCaps: false,
    usesClaimReserveSplit: false,
    clientCanSetAmount: false,
    idempotent: true,
    ledgerAuthoritative: true,
  },
  {
    id: "purchase_credit",
    policyStatus: "disabled_issuance",
    description: "Pi payment fulfillment must not invent GHC without payment intent",
    serverPath: "payments fulfillment only (no client creditPurchase)",
    usesNetworkScarcity: false,
    usesActivityCaps: false,
    usesClaimReserveSplit: false,
    clientCanSetAmount: false,
    idempotent: true,
    ledgerAuthoritative: true,
  },
  {
    id: "transfer_in",
    policyStatus: "redistribution",
    description: "Peer transfer credit (not emission — redistribution)",
    serverPath: "POST /api/economy/transfers → ghc_execute_transfer",
    usesNetworkScarcity: false,
    usesActivityCaps: false,
    usesClaimReserveSplit: false,
    clientCanSetAmount: false,
    idempotent: true,
    ledgerAuthoritative: true,
  },
  {
    id: "peer_request_accept",
    policyStatus: "redistribution",
    description: "Accepted GHC request (redistribution)",
    serverPath: "transfer-request accept RPC",
    usesNetworkScarcity: false,
    usesActivityCaps: false,
    usesClaimReserveSplit: false,
    clientCanSetAmount: false,
    idempotent: true,
    ledgerAuthoritative: true,
  },
] as const

export function emissionChannelsRequiringScarcity(): EmissionChannelSpec[] {
  return EMISSION_CHANNELS.filter((c) => c.usesNetworkScarcity)
}

export function emissionChannelsRequiringActivityCaps(): EmissionChannelSpec[] {
  return EMISSION_CHANNELS.filter((c) => c.usesActivityCaps)
}
