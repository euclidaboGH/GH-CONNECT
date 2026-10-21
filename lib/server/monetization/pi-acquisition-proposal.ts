/**
 * Phase 6: Pi-funded GHC acquisition proposal.
 * This is a policy/proposal registry only. It intentionally cannot initiate
 * Pi payments, mint/credit GHC, or grant wallet entitlements.
 */
export type ProposedGhcPack = {
  id: string
  name: string
  description: string
  piPrice: null
  ghcAmount: null
  purchasable: false
  status: "proposal_only"
}

const PROPOSED_PACKS: readonly ProposedGhcPack[] = [
  { id: "ghc_starter", name: "Starter Pack", description: "Proposed entry-level GHC utility pack; amount and Pi price require approval.", piPrice: null, ghcAmount: null, purchasable: false, status: "proposal_only" },
  { id: "ghc_growth", name: "Growth Pack", description: "Proposed mid-tier GHC utility pack; amount and Pi price require approval.", piPrice: null, ghcAmount: null, purchasable: false, status: "proposal_only" },
  { id: "ghc_community", name: "Community Pack", description: "Proposed larger GHC utility pack; amount and Pi price require approval.", piPrice: null, ghcAmount: null, purchasable: false, status: "proposal_only" },
] as const

export function getPiGhcAcquisitionProposal() {
  return {
    version: "1",
    status: "proposal_only" as const,
    piCheckoutEnabled: false as const,
    durableGhcCreditEnabled: false as const,
    automaticConversionEnabled: false as const,
    packs: PROPOSED_PACKS.map((pack) => ({ ...pack })),
    invariants: [
      "A Pi payment intent or client callback is not proof of completed settlement.",
      "GHC must only be credited by an authenticated, idempotent server-side ledger operation after provider-verified settlement.",
      "Pi payment records and the GHC ledger remain separate authorities and require a durable reconciliation link.",
      "No exchange rate, investment return, cash redemption, or guaranteed GHC value is promised.",
      "Failed, cancelled, expired, duplicated, or disputed payments must never create spendable GHC.",
    ],
    activationGates: [
      "Product and finance approve pack quantities, Pi pricing, disclosures, taxes, refund rules, and economic impact.",
      "Confirm Pi Platform policy and obtain legal/compliance review for the intended acquisition and utility design.",
      "Implement provider/server verification, replay protection, idempotency, and durable payment state transitions.",
      "Implement an atomic or recoverable ledger-credit workflow with unique settlement references and reconciliation.",
      "Test duplicate callbacks, concurrent requests, late settlement, refunds, reversals, and partial failures on Testnet.",
      "Verify authentication, authorization, RLS/grants, rate limits, audit logs, monitoring, and rollback procedures.",
      "Pass supported Node install, typecheck, lint, production build, full CI, and Pi Browser end-to-end tests.",
      "Obtain written product, finance, platform-policy, legal, and release approval before enabling checkout.",
    ],
  }
}
