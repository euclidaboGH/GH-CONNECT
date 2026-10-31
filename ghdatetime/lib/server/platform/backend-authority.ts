/**
 * GreenHaven backend authority registry.
 *
 * This is intentionally a small executable contract: it documents which layer
 * owns mutable state so new UI/API work cannot silently create a second source
 * of truth. Values here are non-secret and safe for operator diagnostics.
 */
export const BACKEND_AUTHORITY = {
  identity: {
    authority: "verified Pi identity + durable session",
    clientPolicy: "never trust client user id as identity",
  },
  dailyGhcIssuance: {
    endpoint: "POST /api/economy/rewards/daily",
    database: "ghc_execute_daily_claim_v12",
    clientPolicy: "server result only; no optimistic credit",
  },
  dailyGhcRedemption: {
    endpoint: "POST /api/economy/rewards/claim",
    database: "pending entitlement redemption lifecycle",
    clientPolicy: "server result only",
  },
  wallet: {
    authority: "durable ghc_transactions ledger + wallet projection",
    clientPolicy: "hydrate/reconcile; never mutate balance locally",
  },
  socialPosts: {
    authority: "server social visibility + durable post store",
    clientPolicy: "optimistic presentation may not become authority",
  },
  curation: {
    authority: "atomic curation RPC + server reputation intelligence",
    clientPolicy: "client choice is intent only",
  },
  marketplace: {
    authority: "durable order/listing RPCs + payment state",
    clientPolicy: "server order state wins",
  },
  messaging: {
    authority: "durable conversation/message store + receipts",
    clientPolicy: "client cache is presentation only",
  },
  notifications: {
    authority: "gh_notification_inbox + realtime recovery journal",
    clientPolicy: "server projection wins",
  },
  media: {
    authority: "durable media asset + upload session + signed authorization",
    clientPolicy: "never trust raw storage path or blob URL",
  },
  communities: {
    authority: "durable community governance/content/membership/events/resources",
    clientPolicy: "local community state is presentation/cache only",
  },
  reputation: {
    authority: "durable reputation intelligence + server-derived curation weight",
    clientPolicy: "client submits choice only; never weight or reward authority",
  },
  creatorEconomy: {
    authority: "verified Pi tip settlement + content rewards + ghc_transactions",
    clientPolicy: "server-recorded settlement only; no fabricated earnings",
  },
  activityCorrelation: {
    authority: "server activity projections + correlation/request identifiers",
    clientPolicy: "client may display correlation but never invent financial attribution",
  },
} as const

export type BackendAuthorityKey = keyof typeof BACKEND_AUTHORITY

export function backendAuthoritySnapshot() {
  return BACKEND_AUTHORITY
}
