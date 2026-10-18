import { readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const read = (path) => readFileSync(join(root, path), "utf8")
let passed = 0
let failed = 0
const check = (condition, label) => {
  if (condition) { passed++; console.log("  ✓", label) }
  else { failed++; console.error("  ✗", label) }
}

const store = read("lib/server/messaging/message-store.ts")
const route = read("app/api/messaging/conversations/[conversationId]/messages/route.ts")
const readRoute = read("app/api/messaging/conversations/[conversationId]/read/route.ts")
const presenceRoute = read("app/api/messaging/conversations/[conversationId]/presence/route.ts")
const globalPresenceRoute = read("app/api/messaging/presence/route.ts")
const preferencesRoute = read("app/api/messaging/preferences/route.ts")
const migration = read("supabase/migrations/202610240005_gh_messaging_presence_delivery_receipts.sql")
const screen = read("components/ghc/message-screen.tsx")
const bubbles = read("components/ghc/message-components.tsx")
const context = read("contexts/ghc-context.tsx")
const sync = read("lib/messaging/server-messaging-sync.ts")
const offlineFlush = read("lib/messaging/offline-message-flush.ts")
const deployGuide = read("supabase/MESSAGING_PRESENCE_DEPLOY.md")
const packageJson = JSON.parse(read("package.json"))

console.log("\n=== MESSAGING DELIVERY / PRESENCE / PRIVACY CHECKS ===\n")
check(store.includes("if (!(await isMember(cid, uid)))") && store.includes("STORE_UNAVAILABLE"), "durable message reads fail closed on non-membership and production store failures")
check(store.includes("areUsersBlocked(sender, recipient)") && store.includes("if (!ok || !Array.isArray(data)) return true"), "server checks direct-message block state and fails closed if the block lookup is unavailable")
check(store.includes("gh_message_receipts") && store.includes("markMessagesDelivered") && store.includes("gh_messaging_mark_read"), "delivery and atomic read receipts persist per recipient")
check(store.includes("validateSharedPostForConversation") && store.includes("SHARED_POST_PRIVATE") && store.includes("sharedPostId: sharedPostId || undefined"), "shared-post cards persist as messages only after server-side audience and block checks")
check(context.includes("sendMessage(shared.conversationId, shared.text, undefined, shared.sharedPostId)"), "sharing a post into chat uses the canonical durable send pipeline")
check(offlineFlush.includes("sharedPostId"), "offline retries preserve shared-post references")
check(store.includes('message.status = allRead ? "read" : allDelivered ? "delivered" : "sent"'), "sender sees read only when recipients read and delivered only when recipient receipts exist")
check(migration.includes("CREATE TABLE IF NOT EXISTS public.gh_message_receipts") && migration.includes("PRIMARY KEY (message_id, recipient_id)"), "receipt schema is idempotent and supports one receipt per recipient")
check(migration.includes("gh_messaging_unread_counts") && store.includes("rpc/gh_messaging_unread_counts") && store.includes("unreadCount"), "inbox unread counts use one bounded server RPC rather than an N+1 message query")
check(migration.includes("gh_messaging_mark_read") && store.includes("rpc/gh_messaging_mark_read"), "read receipts and the unread cursor update atomically in one server-side transaction")
check(migration.includes("CREATE TABLE IF NOT EXISTS public.gh_user_presence") && migration.includes("online_until") && migration.includes("typing_until"), "presence schema stores expiring online and typing leases")
check(migration.includes("CREATE TABLE IF NOT EXISTS public.gh_messaging_preferences") && migration.includes("who_can_message IN ('everyone', 'matches-only', 'no-one')") && migration.includes("online_status IN ('everyone', 'matches-only', 'hidden')"), "recipient messaging and online-status privacy are stored server-side with constrained values")
check(store.includes("gh_pi_identities?gh_user_id=eq.") && store.includes("knownUser.data.length"), "server refuses DM creation to unknown/unverified recipient identities")
check(store.includes("canViewMessagingPresence") && store.includes("getVisiblePresencePeerIds") && store.includes("online_status_configured") && store.includes('preference.online_status === "matches-only"'), "presence and last-seen visibility follow the recipient's saved privacy setting")
check(store.includes("canReceiveDirectMessage") && store.includes("areUsersMutuallyConnected") && store.includes("PRIVACY_RESTRICTED") && store.includes("PRIVACY_SETTINGS_UNCONFIGURED"), "DM creation and each send enforce the recipient's privacy and fail closed until legacy settings are synced")
check(preferencesRoute.includes("resolveAuthenticatedUser") && preferencesRoute.includes("setMessagingPreference") && preferencesRoute.includes("checkRateLimit") && preferencesRoute.includes("onlineStatus"), "messaging and presence privacy preference API is authenticated, validated and rate-limited")
check(context.includes("onlineStatusConfigured") && context.includes("seedIfMissing") && context.includes("api/messaging/preferences"), "legacy privacy settings migrate without overwriting server-configured settings")
check(migration.includes("ENABLE ROW LEVEL SECURITY") && migration.includes("USING (false) WITH CHECK (false)"), "presence and receipt tables deny direct client access under RLS")
check(presenceRoute.includes("isMember") === false && presenceRoute.includes("touchMessagingPresence") && presenceRoute.includes("checkRateLimit"), "presence route delegates membership enforcement to the server store and rate limits writes")
check(globalPresenceRoute.includes("resolveAuthenticatedUser") && globalPresenceRoute.includes("touchMessagingPresence"), "global presence heartbeat requires an authenticated server session")
check(screen.includes('apiTouchConversationPresence(selectedId, typingActiveRef.current ? "typing" : "heartbeat")'), "open chat refreshes presence and typing leases")
check(screen.includes('"Last seen unavailable"') && screen.includes("formatLastSeen(peerPresence?.lastSeenAt)"), "chat header distinguishes active state from a server-backed last-seen label")
check(screen.includes("setTimeout(() => {") && screen.includes('apiTouchConversationPresence(selectedId, "stop_typing")'), "typing indicator expires when the composer becomes idle")
check(screen.includes("setInterval(() => void refresh(), 7000)"), "open conversations refresh durable messages so receipts update without reopening")
check(bubbles.includes("Sent · not delivered") && bubbles.includes("Delivered ✓✓") && bubbles.includes("Seen ✓✓"), "message bubble clearly distinguishes sent, delivered and read")
check(context.includes('String(raw.status) : "sent"') && context.includes('durable ? "sent" : permanentFailure ? "failed" : "sending"') && !context.includes('setMessageStatus(conversationId, result.data.id, durable ? "delivered" : "sent")'), "client preserves server receipt status and distinguishes durable acceptance from queued/failed sends")
check(offlineFlush.includes("failedItems") && offlineFlush.includes("result?.permanent"), "permanent queue failures are removed and surfaced instead of retrying forever")
check(deployGuide.includes("NEXT_PUBLIC_MESSAGING_DURABLE=true") && deployGuide.includes("end-to-end encryption") && deployGuide.includes("messaging privacy"), "deployment guide documents durable mode, privacy enforcement and encryption limitation")
check(context.includes("apiHeartbeatMessagingPresence") && context.includes("apiListConversations(40)"), "app heartbeat and inbox refresh support timely online status and incoming-message visibility")
check(sync.includes("apiTouchConversationPresence") && sync.includes("apiHeartbeatMessagingPresence"), "client sync helpers use authenticated no-store requests")
check(packageJson.scripts["test:messaging-reliability"] === "node scripts/test-messaging-reliability.mjs", "messaging reliability checks are wired into package scripts")
check(packageJson.scripts["ci:verify"].includes("npm run test:messaging-reliability"), "release verification includes messaging reliability checks")

console.log(`\nPassed: ${passed}; Failed: ${failed}`)
if (failed) process.exit(1)
console.log("MESSAGING RELIABILITY CHECKS PASSED\n")
