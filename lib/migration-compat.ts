/**
 * GH Connect — Safe Migration Compatibility Facade
 *
 * Single import surface for gradual architectural migration.
 * Existing components may keep older import paths; new code should prefer
 * `@/lib/domains` and domain hooks under `@/hooks`.
 *
 * This module does NOT introduce competing business logic.
 */

// ── Canonical domain layer ──────────────────────────────────────────────
export {
  createDomainServices,
  runMutation,
  bindDomainServices,
  getBoundDomainServices,
  unwrapMutation,
  mutationSucceeded,
  DOMAIN_SERVICE_ALIASES,
  domainEvents,
  createLocalPostRepository,
  createLocalMessageRepository,
  createLocalReportRepository,
  createHttpPostRepository,
  createHttpMessageRepository,
  createHttpReportRepository,
  createHttpProfileRepository,
  resolveApiBaseUrl,
} from "./domains"

export type {
  DomainServices,
  DomainStateSlice,
  MutationResult,
  MutationSpec,
  PostRepository,
  MessageRepository,
  ReportRepository,
  ProfileRepository,
  DomainServiceAlias,
} from "./domains"

// ── Messaging (writes → messaging-domain; helpers → unified engine) ─────
export {
  filterConversationList,
  prepareMessageForSending,
  handleMessageEdit,
  handleMessageDeletion,
  handleMessageReaction,
  searchMessages,
  toggleConversationPin,
  toggleConversationArchive,
  toggleConversationMute,
} from "./unified-messaging-engine"

// Conversation-engine list helpers remain available via unified re-exports
export {
  filterConversationsByType,
  searchConversations,
  getConversationById,
  getUnreadCount,
} from "./conversation-engine"

// ── Social graph helpers (mutations → social-graph-domain) ───────────────
export {
  isFollowing,
  isBlocked,
  applyBlockEffects,
  filterOutBlockedUsers,
  softDeletePost,
  softDeleteMessage,
  isSoftDeleted,
} from "./social-graph"

export { socialGraphStore } from "./social-graph-store"
export { relationBetween } from "./social-graph-relations"
export {
  isUserBlocked,
  filterBlockedUsers,
  mergeBlockedLists,
} from "./block-enforcement"

// ── Safety / notifications (reports → report-domain) ────────────────────
export { notificationSystem } from "./notifications"
export { smartNotifications } from "./smart-notifications"

// ── Permissions ─────────────────────────────────────────────────────────
export {
  buildPermissionContext,
  canMessageUser,
  canFollow,
  canViewProfile,
  isBlocked as permissionIsBlocked,
} from "./permission-engine"

// ── Backend facade (client adapters until remote API) ───────────────────
export { getBackend, setBackend } from "./backend"
export type { BackendServices } from "./backend"

/**
 * Recommended import migration map (documentation for contributors):
 *
 * | Old / parallel path                         | Prefer                          |
 * |---------------------------------------------|---------------------------------|
 * | ad-hoc setState in UI                       | domains.* via context / hooks   |
 * | lib/backend/http-repositories               | lib/domains/http-repositories   |
 * | conversation-engine direct writes           | messaging-domain + unified API  |
 * | message-state-manager                       | unified-messaging-engine        |
 * | smart-notifications only                    | notificationSystem (+ smart)    |
 * | analytics-service                           | analytics                       |
 * | post-comment-enhancements                   | post-comment-unified-complete   |
 */
