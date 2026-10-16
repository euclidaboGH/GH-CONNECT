/**
 * Messaging premium utilities — optional, never required to talk.
 *
 * FREE forever:
 *   - Send/receive direct messages (subject to privacy & blocks only)
 *   - Group / community chat for members
 *
 * OPTIONAL paid utility (GHC or membership entitlements):
 *   - Premium message requests (reach closed inboxes)
 *   - Priority placement in recipient inbox
 *   - Voice / video call features (membership-gated UX)
 *   - Profile boosts (discovery — not chat)
 *   - Creator subscription tips (future)
 *   - Group premium features (highlights, capacity)
 *   - Marketplace seller inbox tools
 *   - Verified business page messaging tools
 *
 * Principle: GHC is utility fuel — not a tollbooth on conversation.
 */

export type MessagingPremiumProductId =
  | "premium_message_request"
  | "priority_message"
  | "voice_video_day"
  | "profile_boost_messaging"
  | "group_highlight"
  | "seller_inbox_tools"
  | "business_page_tools"

export type MessagingPremiumProduct = {
  id: MessagingPremiumProductId
  title: string
  description: string
  /** GHC price; 0 = membership entitlement only */
  priceGhc: number
  /** Requires VIP/VVIP instead of or in addition to GHC */
  requiresTier?: Array<"vip" | "vvip">
  category: "request" | "priority" | "calls" | "boost" | "group" | "seller" | "business"
  /** Never blocks free sendMessage */
  doesNotGateBasicChat: true
}

export const MESSAGING_PREMIUM_CATALOG: Record<
  MessagingPremiumProductId,
  MessagingPremiumProduct
> = {
  premium_message_request: {
    id: "premium_message_request",
    title: "Premium message request",
    description:
      "Request a conversation when the recipient only accepts requests. Free chat still works for open inboxes.",
    priceGhc: 5,
    category: "request",
    doesNotGateBasicChat: true,
  },
  priority_message: {
    id: "priority_message",
    title: "Priority message",
    description: "Optional highlight in the recipient’s request/inbox list. Does not force delivery.",
    priceGhc: 3,
    category: "priority",
    doesNotGateBasicChat: true,
  },
  voice_video_day: {
    id: "voice_video_day",
    title: "Voice & video (24h)",
    description: "Unlock in-app voice/video controls for a day. Text is never paywalled.",
    priceGhc: 15,
    requiresTier: undefined,
    category: "calls",
    doesNotGateBasicChat: true,
  },
  profile_boost_messaging: {
    id: "profile_boost_messaging",
    title: "Profile boost",
    description: "Discovery visibility boost — not a message fee.",
    priceGhc: 25,
    category: "boost",
    doesNotGateBasicChat: true,
  },
  group_highlight: {
    id: "group_highlight",
    title: "Group highlight",
    description: "Pin/highlight an announcement in a group you admin. Members still chat free.",
    priceGhc: 10,
    category: "group",
    doesNotGateBasicChat: true,
  },
  seller_inbox_tools: {
    id: "seller_inbox_tools",
    title: "Seller inbox tools",
    description: "Order-linked quick replies and filters for marketplace sellers.",
    priceGhc: 20,
    category: "seller",
    doesNotGateBasicChat: true,
  },
  business_page_tools: {
    id: "business_page_tools",
    title: "Verified business tools",
    description: "Business-page inbox labels and auto-greet (verification still separate).",
    priceGhc: 40,
    requiresTier: ["vip", "vvip"],
    category: "business",
    doesNotGateBasicChat: true,
  },
}

/** Explicit product promise for UI copy */
export const MESSAGING_FREE_GUARANTEE =
  "Messaging is free. Optional GHC tools never block normal conversation."

export function listMessagingPremiumProducts(): MessagingPremiumProduct[] {
  return Object.values(MESSAGING_PREMIUM_CATALOG)
}

export function getMessagingPremiumProduct(
  id: string
): MessagingPremiumProduct | null {
  return MESSAGING_PREMIUM_CATALOG[id as MessagingPremiumProductId] || null
}
