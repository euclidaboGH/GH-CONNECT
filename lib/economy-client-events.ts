/**
 * Client-side economy refresh broadcasts.
 * Use after any durable fee, claim, order, or membership mutation so Wallet/Rewards
 * revalidate without requiring logout.
 */
import { emitGhcAppEvent, GHC_APP_EVENTS } from "@/lib/ghc-app-events"

export function emitEconomyClientRefresh(reason: string) {
  emitGhcAppEvent(GHC_APP_EVENTS.WALLET_REFRESH, { reason })
  emitGhcAppEvent(GHC_APP_EVENTS.WALLET_SYNCED, { reason })
}
