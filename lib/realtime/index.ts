export { domainEvents } from "./event-bus"
export type { DomainEvent, DomainEventType } from "./event-bus"
export { useDomainEvent, useDomainEvents, subscribeDomainCache } from "./use-domain-events"
export {
  transportBridge,
  LocalTransport,
  WebSocketTransport,
  enableWebSocketTransport,
} from "./transport-bridge"
export type { RealtimeTransport } from "./transport-bridge"
export {
  presenceStore,
  getPresenceSnapshot,
} from "./presence"
export type { PresenceStatus, PresenceEntry } from "./presence"
export { REALTIME_EVENT_GROUPS } from "./domain-event-catalog"
export type {
  RealtimeEventGroup,
  MessageCreatedPayload,
  TypingPayload,
  PresencePayload,
  RelationshipUserPayload,
  MatchPayload,
  PostPayload,
  CommentPayload,
  StoryPayload,
  CommunityPayload,
  MarketplaceOrderPayload,
  WalletPayload,
  RewardPayload,
} from "./domain-event-catalog"
