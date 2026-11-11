/**
 * Canonical, side-effect-free notification target resolution.
 * IDs are routing hints only; target records are reloaded through their normal
 * authenticated domain APIs before anything sensitive is displayed.
 */
export type NotificationDeepLink = {
  open?: "feed" | "home" | "chat" | "messages" | "wallet" | "rewards" | "membership" | "communities" | "discover" | "matches" | "profile" | "settings" | "marketplace"
  tab?: "home" | "discover" | "matches" | "messages" | "communities" | "profile" | "wallet" | "rewards" | "membership" | "settings" | "marketplace"
  section?: "post" | "comments" | "conversation" | "transaction" | "transfer-request" | "friend-request" | "connection_requests" | "group-request" | "membership" | "verification" | "security" | "listing" | "order" | "response" | "history" | "payment" | "claim"
  id?: string
  postId?: string
  commentId?: string
  parentId?: string
  threadRootId?: string
  conversationId?: string
  userId?: string
  transactionId?: string
  paymentIntentId?: string
  payoutRequestId?: string
  requestId?: string
  referenceId?: string
  rewardId?: string
  claimId?: string
  groupId?: string
  greenHavenId?: string
  listingId?: string
  orderId?: string
  responseAction?: string
  responseAt?: number
}

export type NotificationTargetInput = {
  id?: string
  type?: string
  data?: Record<string, unknown> | null
}

const ALLOWED_OPEN = new Set(["feed", "home", "chat", "messages", "wallet", "rewards", "membership", "communities", "discover", "matches", "profile", "settings", "marketplace"])
const ALLOWED_TAB = new Set(["home", "discover", "matches", "messages", "communities", "profile", "wallet", "rewards", "membership", "settings", "marketplace"])
const ALLOWED_SECTION = new Set(["post", "comments", "conversation", "transaction", "transfer-request", "friend-request", "connection_requests", "group-request", "membership", "verification", "security", "listing", "order", "response", "history", "payment", "claim"])

function cleanId(value: unknown, max = 180): string | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined
  const text = String(value).trim()
  if (!text || text.length > max || /[\u0000-\u001f\u007f]/.test(text)) return undefined
  if (/^https?:/i.test(text) || /^javascript:/i.test(text) || text.includes("://")) return undefined
  return text
}

function pick(data: Record<string, unknown>, keys: string[], max = 180): string | undefined {
  for (const key of keys) {
    const value = cleanId(data[key], max)
    if (value) return value
  }
  return undefined
}

function normalizeOpen(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : ""
}

/** Only same-origin absolute-path destinations are valid for admin announcements. */
export function isSafeInternalNotificationPath(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > 1024 || value.trim() !== value) return false
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return false
  if (/[\u0000-\u001f\u007f]/.test(value) || /%(?:2f|5c|0[0-9a-f]|1[0-9a-f]|7f)/i.test(value)) return false
  try {
    const parsed = new URL(value, "https://ghc-notification.invalid")
    return parsed.origin === "https://ghc-notification.invalid" && parsed.username === "" && parsed.password === ""
  } catch {
    return false
  }
}

export function sanitizeNotificationDeepLink(link: NotificationDeepLink): NotificationDeepLink {
  const out: NotificationDeepLink = {}
  const open = normalizeOpen(link.open)
  const tab = normalizeOpen(link.tab)
  const section = normalizeOpen(link.section)
  if (ALLOWED_OPEN.has(open)) out.open = open as NotificationDeepLink["open"]
  if (ALLOWED_TAB.has(tab)) out.tab = tab as NotificationDeepLink["tab"]
  if (ALLOWED_SECTION.has(section)) out.section = section as NotificationDeepLink["section"]
  const fields: Array<keyof NotificationDeepLink> = [
    "id", "postId", "commentId", "parentId", "threadRootId", "conversationId", "userId",
    "transactionId", "paymentIntentId", "payoutRequestId", "requestId", "referenceId",
    "rewardId", "claimId", "groupId", "greenHavenId", "listingId", "orderId", "responseAction",
  ]
  for (const field of fields) {
    const value = cleanId(link[field])
    if (value) (out as Record<string, unknown>)[field] = value
  }
  const responseAt = Number(link.responseAt)
  if (Number.isFinite(responseAt) && responseAt > 0) out.responseAt = responseAt
  return out
}

/** Resolve old and new event shapes without trusting arbitrary URL/action fields. */
export function resolveNotificationDeepLinkFromRecord(input: NotificationTargetInput): NotificationDeepLink {
  const raw = input.data && typeof input.data === "object" ? input.data : {}
  const correlation = raw.correlation && typeof raw.correlation === "object"
    ? raw.correlation as Record<string, unknown>
    : {}
  const data: Record<string, unknown> = { ...raw, ...correlation }
  const forced = raw.deepLink && typeof raw.deepLink === "object"
    ? raw.deepLink as Record<string, unknown>
    : {}
  const type = normalizeOpen(input.type)
  const event = normalizeOpen(data.eventType || data.socialType || data.notificationType || data.type || input.type)
  const eventUpper = event.toUpperCase()
  const entityType = normalizeOpen(data.entityType || data.sourceType)
  const entityId = pick(data, ["entityId", "entity_id", "sourceId", "source_id"])
  const isSocialContentEvent = ["like", "post_like", "comment", "post_comment", "comment_reply", "share", "mention", "story_reply", "curation", "upvote", "downvote"].includes(type)
    || /POST_LIKE|POST_COMMENT|COMMENT_REPLY|MENTION|CURATION|SHARE|UPVOTE|DOWNVOTE/.test(eventUpper)

  const base: NotificationDeepLink = {
    id: cleanId(input.id),
    postId: pick(data, ["postId", "post_id", "contentId", "content_id"]) || (entityType === "post" ? entityId : undefined),
    commentId: pick(data, ["commentId", "comment_id"]) || (entityType === "comment" ? entityId : undefined),
    parentId: pick(data, ["parentId", "parent_id"]),
    threadRootId: pick(data, ["threadRootId", "thread_root_id"]),
    conversationId: pick(data, ["conversationId", "conversation_id", "threadId", "thread_id"]) || ((entityType === "conversation" || entityType === "message") ? entityId : undefined),
    userId: pick(data, ["userId", "user_id", "fromUserId", "from_user_id", "actorUserId", "actor_user_id", "counterpartyId", "counterparty_id"]),
    transactionId: pick(data, ["transactionId", "transaction_id", "txId", "txid"]),
    paymentIntentId: pick(data, ["paymentIntentId", "payment_intent_id", "intentId", "intent_id", "paymentId", "payment_id"]),
    payoutRequestId: pick(data, ["payoutRequestId", "payout_request_id"]),
    requestId: pick(data, ["requestId", "request_id"]),
    referenceId: pick(data, ["referenceId", "reference_id", "sourceReference", "source_reference"]),
    rewardId: pick(data, ["rewardId", "reward_id"]),
    claimId: pick(data, ["claimId", "claim_id", "holdId", "hold_id"]),
    groupId: pick(data, ["groupId", "group_id", "communityId", "community_id"]),
    greenHavenId: pick(data, ["greenHavenId", "green_haven_id"]),
    listingId: pick(data, ["listingId", "listing_id", "marketplaceListingId", "marketplace_listing_id"]) || (entityType === "listing" ? entityId : undefined),
    orderId: pick(data, ["orderId", "order_id", "marketplaceOrderId", "marketplace_order_id"]) || (entityType === "order" ? entityId : undefined),
    responseAction: pick(data, ["responseAction", "response_action", "action"], 80),
    responseAt: (() => {
      const rawAt = data.responseAt ?? data.response_at ?? data.updatedAt ?? data.updated_at
      if (typeof rawAt === "number" && Number.isFinite(rawAt) && rawAt > 0) return rawAt
      if (typeof rawAt === "string" && rawAt.trim()) {
        const parsed = Date.parse(rawAt)
        if (Number.isFinite(parsed) && parsed > 0) return parsed
      }
      return undefined
    })(),
  }

  // Economy rows historically put their transaction reference outside metadata.
  if (!base.transactionId && (eventUpper.includes("TRANSFER") || eventUpper.includes("GHC_SENT") || eventUpper.includes("GHC_RECEIVED") || eventUpper.includes("TRANSACTION"))) {
    base.transactionId = base.referenceId
  }
  if (!base.claimId && /CLAIM|DAILY_REWARD/.test(eventUpper)) base.claimId = base.referenceId
  if (!base.rewardId && /REWARD|DAILY_CLAIM/.test(eventUpper)) base.rewardId = base.claimId || base.referenceId
  if (!base.orderId && /MARKETPLACE.*ORDER|ORDER.*MARKETPLACE/.test(eventUpper)) base.orderId = entityId || base.referenceId
  if (!base.listingId && /MARKETPLACE.*LISTING|LISTING.*MARKETPLACE/.test(eventUpper)) base.listingId = entityId || base.referenceId
  if (!base.paymentIntentId && /PAYMENT|^PI_/.test(eventUpper) && entityType === "payment") base.paymentIntentId = entityId

  const explicitOpen = normalizeOpen(forced.open || data.open)
  const explicitTab = normalizeOpen(forced.tab || data.tab)
  const explicitSection = normalizeOpen(forced.section || data.section)
  const link: NotificationDeepLink = { ...base }

  if (explicitOpen === "feed" || explicitOpen === "home" || explicitOpen === "post") {
    link.open = "feed"; link.tab = "home"; link.section = base.commentId ? "comments" : "post"
  } else if (explicitOpen === "chat" || explicitOpen === "messages") {
    link.open = "chat"; link.tab = "messages"; link.section = "conversation"
  } else if (explicitOpen === "wallet" || explicitOpen === "transaction" || explicitOpen === "payment") {
    link.open = "wallet"; link.tab = "wallet"; link.section = explicitSection === "transfer-request" ? "transfer-request" : "transaction"
  } else if (explicitOpen === "requests") {
    link.open = "wallet"; link.tab = "wallet"; link.section = "transfer-request"
  } else if (explicitOpen === "rewards" || explicitOpen === "reward" || explicitOpen === "daily_claim") {
    link.open = "rewards"; link.tab = "rewards"; link.section = "history"
  } else if (explicitOpen === "membership" || explicitOpen === "premium") {
    link.open = "membership"; link.tab = "membership"; link.section = "membership"
  } else if (explicitOpen === "communities" || explicitOpen === "community") {
    link.open = "communities"; link.tab = "communities"
  } else if (explicitOpen === "matches") {
    link.open = "matches"; link.tab = "matches"
  } else if (explicitOpen === "discover" || explicitOpen === "find") {
    link.open = "discover"; link.tab = "discover"
  } else if (explicitOpen === "marketplace" || explicitOpen === "market" || explicitOpen === "orders") {
    link.open = "marketplace"; link.tab = "home"; link.section = base.orderId ? "order" : "listing"
  } else if (explicitOpen === "security" || explicitOpen === "verification" || explicitOpen === "settings") {
    if (type === "system" || normalizeOpen(data.category) === "system") {
      link.open = "settings"; link.tab = "settings"
      if (["security", "verification", "membership"].includes(explicitSection)) link.section = explicitSection as NotificationDeepLink["section"]
    } else {
      link.open = "feed"; link.tab = "home"; link.section = "post"
    }
  } else if (!isSocialContentEvent && (base.listingId || base.orderId || /MARKETPLACE|LISTING|ORDER_RESPONSE|ORDER_UPDATED/.test(eventUpper) || type.startsWith("marketplace_"))) {
    link.open = "marketplace"; link.tab = "home"; link.section = base.orderId ? "order" : "listing"
  } else if (base.paymentIntentId || /PAYMENT|^PI_/.test(eventUpper) || type === "payment") {
    link.open = "wallet"; link.tab = "wallet"; link.section = "transaction"
  } else if (base.rewardId || base.claimId || /REWARD|CLAIM|STREAK/.test(eventUpper) || type === "reward") {
    link.open = "rewards"; link.tab = "rewards"; link.section = "history"
  } else if (type === "message" || /MESSAGE|CHAT|DIRECT_MESSAGE/.test(eventUpper)) {
    link.open = "chat"; link.tab = "messages"; link.section = "conversation"
  } else if (type === "group") {
    link.open = "communities"; link.tab = "communities"
  } else if (type === "match") {
    link.open = "matches"; link.tab = "matches"
  } else if (["friend_request", "connection_request", "connection_accept", "connection"].includes(type)) {
    link.open = "matches"; link.tab = "matches"; link.section = "connection_requests"
  } else if (type === "follow") {
    link.open = "discover"; link.tab = "discover"
  } else if (["like", "post_like", "comment", "post_comment", "comment_reply", "share", "mention", "story_reply", "curation", "upvote", "downvote"].includes(type) || /POST_LIKE|POST_COMMENT|COMMENT_REPLY|MENTION|CURATION|SHARE|UPVOTE|DOWNVOTE/.test(eventUpper)) {
    link.open = "feed"; link.tab = "home"; link.section = base.commentId || /COMMENT|REPLY|MENTION/.test(eventUpper) || type === "comment" || type === "comment_reply" ? "comments" : "post"
  } else if (/GHC_SENT|GHC_RECEIVED|TRANSFER|TRANSACTION/.test(eventUpper) || type === "ghc_sent" || type === "ghc_received") {
    link.open = "wallet"; link.tab = "wallet"; link.section = "transaction"
  } else if (type === "system") {
    const blob = `${String(data.title || "")} ${String(data.body || "")}`.toLowerCase()
    if (/privacy|security|password|verification|restricted/.test(blob)) { link.open = "settings"; link.tab = "settings"; link.section = /verif/.test(blob) ? "verification" : "security" }
    else if (/reward|streak|mission|claim/.test(blob)) { link.open = "rewards"; link.tab = "rewards"; link.section = "history" }
    else if (/wallet|ghc|transfer|payment/.test(blob)) { link.open = "wallet"; link.tab = "wallet"; link.section = "transaction" }
    else { link.open = "feed"; link.tab = "home" }
  } else {
    link.open = "feed"; link.tab = "home"
  }

  // Marketplace post comments belong to the listing, not the generic feed.
  if (base.listingId && !base.orderId && !isSocialContentEvent && /MARKETPLACE|LISTING/.test(eventUpper)) {
    link.open = "marketplace"; link.tab = "home"; link.section = "listing"
  }

  // Explicit target IDs and sections can enrich, but never redirect to Settings
  // for social or financial events.
  const merged: NotificationDeepLink = { ...link }
  for (const [key, value] of Object.entries(forced)) {
    if (value !== undefined && value !== null && value !== "") (merged as Record<string, unknown>)[key] = value
  }
  if ((type !== "system" && type !== "unknown") && (merged.open === "settings" || merged.tab === "settings")) {
    merged.open = base.listingId || base.orderId ? "marketplace" : base.paymentIntentId || base.transactionId ? "wallet" : base.postId ? "feed" : "feed"
    merged.tab = merged.open === "marketplace" ? "home" : merged.open === "wallet" ? "wallet" : "home"
    merged.section = base.listingId || base.orderId ? (base.orderId ? "order" : "listing") : base.paymentIntentId || base.transactionId ? "transaction" : "post"
  }
  if (explicitTab && !merged.tab) merged.tab = explicitTab as NotificationDeepLink["tab"]
  if (explicitSection && !merged.section) merged.section = explicitSection as NotificationDeepLink["section"]
  return sanitizeNotificationDeepLink(merged)
}
