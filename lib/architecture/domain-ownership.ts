/**
 * Phase 1 — explicit domain ownership boundaries.
 * UI must not become the authority for any of these domains.
 */
export const DOMAIN_OWNERS = {
  identity: {
    server: ["lib/server/identity", "lib/server/economy/auth.ts"],
    clientRead: ["contexts/identity-context.tsx", "contexts/pi-auth-context.tsx"],
    authority: "server",
  },
  walletGhc: {
    server: ["lib/server/economy", "app/api/economy"],
    clientRead: ["contexts/domains/wallet-read-provider.tsx", "features/wallet"],
    authority: "server",
  },
  walletPiEarnings: {
    server: ["lib/server/earnings", "app/api/economy/earnings"],
    clientRead: ["components/ghc/unified-earnings-dashboard.tsx"],
    authority: "server",
  },
  marketplace: {
    server: ["lib/server/marketplace", "app/api/marketplace"],
    clientRead: ["components/ghc/marketplace-screen.tsx", "lib/domains/marketplace-domain.ts"],
    authority: "server",
  },
  membership: {
    server: ["lib/server/membership", "app/api"],
    clientRead: ["components/ghc/premium-membership-screen.tsx"],
    authority: "server",
  },
  messaging: {
    server: ["lib/server/messaging", "app/api"],
    clientRead: ["contexts/domains/messaging-provider.tsx", "components/ghc/message-screen.tsx"],
    authority: "server",
  },
  feed: {
    server: ["lib/server/social", "app/api"],
    clientRead: ["contexts/domains/feed-provider.tsx", "components/ghc/enhanced-feed-screen.tsx"],
    authority: "server",
  },
  media: {
    server: ["lib/server/media", "app/api/media"],
    clientRead: ["lib/media"],
    authority: "server",
  },
  rewards: {
    server: ["lib/server/economy/reward-engine.ts", "lib/server/economy/claim-engine.ts", "lib/server/content-reward", "app/api/economy/rewards"],
    clientRead: ["lib/rewards", "components/ghc/rewards-centre-screen.tsx"],
    authority: "server",
  },
  communities: {
    server: ["lib/server/community", "app/api/communities"],
    clientRead: ["components/ghc/premium-community-hub.tsx"],
    authority: "server",
  },
  notifications: {
    server: ["lib/server/notifications", "app/api/notifications"],
    clientRead: ["contexts/domains/notifications-provider.tsx", "components/ghc/notification-bell.tsx"],
    authority: "server",
  },
  trustSafety: {
    server: ["lib/server/security", "lib/server/community/governance-store.ts", "app/api/reports"],
    clientRead: ["components/ghc/report-chooser.tsx"],
    authority: "server",
  },
  payments: {
    server: ["lib/server/payments", "lib/server/pi", "app/api/payments", "app/api/economy/earnings/withdrawals"],
    clientRead: ["lib/client/pi-wallet-consent.ts"],
    authority: "server",
  },
} as const

export type DomainKey = keyof typeof DOMAIN_OWNERS

/** Financial domains that must never accept client-authoritative amounts for settlement. */
export const FINANCIAL_DOMAINS: DomainKey[] = ["walletGhc", "walletPiEarnings", "marketplace", "membership", "rewards", "payments"]
