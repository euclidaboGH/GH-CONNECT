/**
 * Domain layer — canonical services + golden mutation path.
 *
 * Prefer: createDomainServices(getState) and call domain methods
 * instead of ad-hoc writes in UI components.
 *
 * Gradual migration: import adapters from `./compat` or `@/lib/migration-compat`
 * when older modules still depend on non-domain paths.
 */

export * from "./types"
export { runMutation } from "./mutation-pipeline"
export type { MutationResult, MutationSpec } from "./mutation-pipeline"

export { createUserDomain, createIdentityDomain } from "./user-domain"
export type { IdentityDomain, UserDomain, IdentityDomainDeps } from "./user-domain"
export { createPostDomain } from "./post-domain"
export { createSocialGraphDomain } from "./social-graph-domain"
export type { SocialGraphDomain, GraphCtx } from "./social-graph-domain"
export {
  assertTransition,
  blockPreemptsInteraction,
  blockClearsContradictions,
  GRAPH_TRANSITION_SUMMARY,
} from "./graph-transitions"
export type { GraphTransition, TransitionContext } from "./graph-transitions"
export {
  shouldHideContentFrom,
  shouldSuppressNotificationFrom,
  isInteractionRestricted,
  filterMutedContent,
  filterMutedNotifications,
  describeSoftLimit,
} from "../mute-restrict-policy"
export type { SoftLimitKind } from "../mute-restrict-policy"
export {
  applyGraphPatch,
  patchFromFollow,
  patchFromBlock,
  patchFromUnblock,
  patchFromMute,
  patchFromRestrict,
  patchFromFriendRemoved,
  patchFromMatchIds,
  syncSessionEdgesToStore,
  sessionSliceFromSnapshot,
  emptyGraphSessionSlice,
} from "./graph-session-adapter"
export type { GraphSessionSlice } from "./graph-session-adapter"
export {
  createMessagingDomain,
  canTransitionMessageStatus,
  resolveMessageStatus,
  MESSAGE_STATUSES,
} from "./messaging-domain"
export type {
  MessagingDomain,
  ConversationKind,
  MessagingConversationType,
  MessageStatus,
} from "./messaging-domain"
export {
  applyMessageAppend,
  applyMessageUpdate,
  applyConversationUpsert,
  applyConversationPatch,
  domainMessageToUi,
} from "./messaging-session-adapter"
export { createReportDomain } from "./report-domain"
export { createFeedDomain, CANONICAL_FEED_MODES } from "./feed-domain"
export type { FeedDomain, CanonicalFeedMode } from "./feed-domain"
export { createShareDomain } from "./share-domain"
export { createStoryDomain, STORY_TTL_MS } from "./story-domain"
export type { StoryDomain } from "./story-domain"
export { createDiscoveryDomain } from "./discovery-domain"
export type {
  DiscoveryDomain,
  FindDomain,
  FindSurface,
  RecommendationSignals,
  ScoredCandidate,
} from "./discovery-domain"
export {
  createMatchingDomain,
  MATCH_INTENTIONS,
  intentionsFromPrimaryMode,
} from "./matching-domain"
export type { MatchingDomain, MatchQualityResult } from "./matching-domain"
export {
  createCommunityDomain,
  canCommunityAction,
  normalizeRole,
  isCommunityConversation,
  conversationChannelKind,
  COMMUNITY_ROLES,
} from "./community-domain"
export type {
  CommunityDomain,
  CommunityRole,
  CommunityAction,
  CommunityPrivacy,
} from "./community-domain"
export {
  createProfileDomain,
  performProfileRelationshipAction,
} from "./profile-domain"
export type {
  ProfileDomain,
  DigitalIdentityView,
  ProfileRelationshipState,
  ProfileRelationshipAction,
} from "./profile-domain"
export {
  createNotificationDomain,
  defaultNotificationPreferences,
  loadNotificationPreferences,
  saveNotificationPreferences,
  mapEventToNotification,
  NOTIFICATION_CATEGORIES,
} from "./notification-domain"
export type {
  NotificationDomain,
  NotificationCategory,
  NotificationPreferences,
  NotificationChannelPrefs,
  ExplicitNotificationInput,
} from "./notification-domain"
export {
  hydrateBackendRepositories,
  syncPendingBackendWrites,
  isBackendConfigured,
  backendAuthorityMap,
} from "./backend-sync"
export {
  createEconomyDomain,
  createLocalEconomyRepository,
} from "./economy-domain"
export type { EconomyDomain, EconomyRepository } from "./economy-domain"
export { createReputationDomain, tierFromScore, REPUTATION_WEIGHTS } from "./reputation-domain"
export type { ReputationDomain, ReputationSnapshot, ReputationTier, ReputationSignalKind } from "./reputation-domain"
export { createAchievementDomain, ACHIEVEMENT_CATALOG } from "./achievement-domain"
export type { AchievementDomain, AchievementId, UnlockedAchievement, AchievementDefinition } from "./achievement-domain"
export {
  createMembershipDomain,
  MEMBERSHIP_PLANS,
  tierFromTrialAnchor,
  TRIAL_VVIP_MS,
  TRIAL_VIP_MS,
  getMembershipStatus,
} from "./membership-domain"
export type { MembershipDomain, MembershipTierId, EntitlementKey, MembershipPlan, MembershipStatus } from "./membership-domain"
export { createVerificationDomain } from "./verification-domain"
export type { VerificationDomain, VerificationType, VerificationStatus, VerificationSnapshot } from "./verification-domain"
export { createMarketplaceDomain, MARKETPLACE_CATEGORIES, PROMOTION_CATALOG } from "./marketplace-domain"
export { createPaymentDomain } from "./payment-domain"
export { createSearchDomain } from "./search-domain"
export type { SearchDomain, SearchHit, SearchQuery, SearchEntityType, SearchResponse } from "./search-domain"
export type { PaymentDomain } from "./payment-domain"
export { PI_PAYMENT_READINESS } from "./payment-types"
export type {
  PaymentIntent,
  PaymentProviderId,
  PaymentLifecycleStatus,
  InitiatePaymentInput,
  ServerPaymentVerification,
} from "./payment-types"
export type {
  MarketplaceDomain,
  MarketplaceListing,
  MarketplaceOrder,
  MarketplaceReview,
  SellerProfileView,
  ListingKind,
  OrderStatus,
  PromotionKind,
} from "./marketplace-domain"
export type {
  GhcTransaction,
  GhcWalletSnapshot,
  RewardRecord,
  RewardRule,
  RewardCategory,
  PremiumMembership,
  EconomyLimits,
} from "./economy-types"
export { DEFAULT_REWARD_RULES, REWARD_CATEGORIES } from "./reward-rules"
export { DEFAULT_ECONOMY_LIMITS } from "./economy-types"
export { createDomainServices } from "./create-domains"
export type { DomainServices, DomainStateSlice } from "./create-domains"

export { domainEvents } from "../realtime/event-bus"
export type { DomainEvent, DomainEventType } from "../realtime/event-bus"
export { REALTIME_EVENT_GROUPS } from "../realtime/domain-event-catalog"
export {
  transportBridge,
  presenceStore,
  enableWebSocketTransport,
} from "../realtime"

export type {
  PostRepository,
  MessageRepository,
  ReportRepository,
  ProfileRepository,
} from "./repositories"
export {
  createLocalPostRepository,
  createLocalMessageRepository,
  createLocalReportRepository,
} from "./repositories"

/** HTTP adapters — single authoritative implementation for remote repos */
export {
  createHttpPostRepository,
  createHttpMessageRepository,
  createHttpReportRepository,
  createHttpProfileRepository,
  resolveApiBaseUrl,
  type HttpRepoConfig,
} from "./http-repositories"

/** Compatibility helpers for gradual consumer migration */
export {
  bindDomainServices,
  getBoundDomainServices,
  createSessionDomainServices,
  unwrapMutation,
  mutationSucceeded,
  DOMAIN_SERVICE_ALIASES,
} from "./compat"
export type { DomainServiceAlias } from "./compat"

export {
  processMediaFile,
  processImagesForPost,
  revokeMediaReferences,
  assertSafeMediaRefsForStorage,
  MEDIA_LIMITS,
} from "../media-pipeline"
export type { MediaReference, MediaPipelineOutcome } from "../media-pipeline"
export {
  MOBILE_PAGE_SIZES,
  paginateSlice,
  optimizedImageUrl,
  afterFirstPaint,
  preferReducedData,
} from "../mobile-performance"

export { createChallengeEngine, DEFAULT_CHALLENGES } from "./reward-challenges"
export type { RewardChallenge, ChallengeProgress, ChallengeStatus } from "./reward-challenges"

export {
  DEFAULT_ANTI_ABUSE_POLICY,
  auditLedgerIntegrity,
  summarizeIntegrity,
} from "./economy-integrity"
export type { EconomyAntiAbusePolicy, IntegrityFinding } from "./economy-integrity"

export { runFullConsistencyAudit, auditRelationshipConsistency, auditDomainSurface } from "./consistency-audit"

export type {
  EconomyPersistenceMode,
  GhcTransferIntent,
  GhcTransferResult,
  GhcTransferErrorCode,
  GhcTransferError,
} from "./economy-transfer-contract"
export { mapTransferFailure, toTransferHttpBody } from "./economy-transfer-contract"
export * from "./gh-account"
