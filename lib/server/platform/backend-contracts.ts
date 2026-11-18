/**
 * GreenHaven Phase 39 final backend convergence contract.
 *
 * Every persistent product surface has one authoritative server boundary.
 * UI/domain caches may mirror state, but they may not become a second writer.
 */
export const BACKEND_CONTRACT_VERSION = "39.1-final-convergence" as const

export const BACKEND_CONTRACTS = {
  identity: {
    authority: "Pi identity verification + durable gh_sessions/gh_pi_identities",
    writeBoundary: "authenticated server routes + identity/session stores",
    forbidden: ["client userId authorization", "process-memory session authority"],
  },
  database: {
    authority: "Supabase public schema + ordered migrations",
    migrationCount: 131,
    executableTableCount: 114,
    writeBoundary: "service-role server RPCs / server-side REST",
    forbidden: ["browser service-role access", "local schema invention"],
  },
  social: {
    authority: "durable gh_posts + canonical visibility + canonical v3 feed/comment RPCs",
    writeBoundaries: ["/api/social/posts", "/api/social/posts/[id]/comments", "/api/social/posts/[id]/curation"],
    forbidden: ["legacy feed RPC fallback", "legacy comment RPC fallback", "client-only durable post state"],
  },
  economy: {
    authority: "ghc_transactions ledger + atomic economy RPCs",
    writeBoundaries: ["/api/economy/rewards/daily", "/api/economy/rewards/claim", "/api/economy/ledger/spend", "/api/economy/transfers"],
    forbidden: ["client-created balance", "optimistic financial success", "serverless memory financial authority"],
  },
  payments: {
    authority: "ghc_payment_intents + verified Pi provider completion",
    writeBoundaries: ["/api/payments/approve", "/api/payments/complete", "/api/payments/fulfill", "/api/payments/incomplete"],
    forbidden: ["client payment completion", "payment callback as settlement proof"],
  },
  membership: {
    authority: "durable membership entitlement + reconciled payment intent",
    writeBoundaries: ["/api/membership/status", "/api/membership/reconcile", "/api/membership/activate"],
    forbidden: ["client tier authority", "local paid-membership persistence in production"],
  },
  marketplace: {
    authority: "durable listing/order state + payment/escrow lifecycle",
    writeBoundaries: ["/api/marketplace/orders", "/api/marketplace/orders/[orderId]/pay", "/api/marketplace/orders/[orderId]/commerce"],
    forbidden: ["client order state as authority", "local-only inventory reservation"],
  },
  messaging: {
    authority: "durable conversations/messages/receipts",
    writeBoundaries: ["/api/messaging/conversations", "/api/messaging/conversations/[conversationId]/messages", "/api/messaging/conversations/[conversationId]/read"],
    forbidden: ["client-only message delivery", "local-only marketplace conversation"],
  },
  notifications: {
    authority: "gh_notification_inbox + gh_realtime_events recovery journal",
    writeBoundaries: ["/api/notifications", "/api/realtime/events"],
    forbidden: ["independent notification inboxes", "client-created notifications"],
  },
  communities: {
    authority: "durable community governance/content/membership/events/resources",
    writeBoundaries: ["/api/communities"],
    forbidden: ["local community membership authority", "legacy local board posts"],
  },
  media: {
    authority: "gh_media_assets + upload sessions + signed authorization",
    writeBoundaries: ["/api/media/direct-upload-intent", "/api/media/direct-upload-complete", "/api/media/[id]/signed-url"],
    forbidden: ["blob URL as durable media", "unowned storage path authorization"],
  },
  reputationCuration: {
    authority: "gh_reputation_intelligence + atomic curation RPC",
    writeBoundaries: ["/api/social/reputation/intelligence", "/api/social/posts/[id]/curation"],
    forbidden: ["client curation weight", "vote-only legacy reward fallback"],
  },
  creatorEconomy: {
    authority: "verified tip settlements + content rewards + ghc_transactions",
    writeBoundaries: ["/api/social/creator", "/api/social/tips", "/api/payments/complete"],
    forbidden: ["client earnings", "unverified tip payable state"],
  },
  activityCorrelation: {
    authority: "server-emitted activity + correlation envelope",
    writeBoundaries: ["server event writers / activity projections"],
    forbidden: ["client fabricated ledger attribution", "missing correlation on financial mutations"],
  },
} as const

export type BackendContractKey = keyof typeof BACKEND_CONTRACTS
