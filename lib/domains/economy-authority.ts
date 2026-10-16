/**
 * GHC ledger authority contract.
 *
 * Pi and GHC are separate assets. Never convert 1 π = X GHC on the client.
 *
 * Server mode (HTTP economy repo):
 * - Spend / membership / marketplace / boost → POST /api/economy/ledger/spend
 * - Reward claim / daily → POST /api/economy/rewards/claim
 * - Reward stage → POST /api/economy/rewards/evaluate
 * - P2P transfer → POST /api/economy/transfers
 * - Purchase credit → only after server-verified Pi payment completion + hydrate
 *
 * Local mode (Studio): localStorage ledger allowed for offline demos only.
 */
export const GHC_LEDGER_RULE =
  "No client-invented available balance when economy repository mode is server"

export type GhcMoneyMovement =
  | "spend"
  | "claim"
  | "evaluate"
  | "transfer"
  | "purchase_credit"

export function isServerAuthoritativeRepo(repo: { mode?: string } | null | undefined): boolean {
  return repo?.mode === "server"
}
