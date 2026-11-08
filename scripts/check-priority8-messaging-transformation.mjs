#!/usr/bin/env node
import fs from 'node:fs'
const read = (path) => fs.readFileSync(path, 'utf8')
const pkg = JSON.parse(read('package.json'))
const lock = JSON.parse(read('package-lock.json'))
const release = read('lib/app-release.ts')
const screen = read('components/ghc/message-screen.tsx')
const parts = read('components/ghc/message-components.tsx')
const store = read('lib/server/messaging/message-store.ts')
const conversations = read('app/api/messaging/conversations/route.ts')
const messages = read('app/api/messaging/conversations/[conversationId]/messages/route.ts')
const prefs = read('app/api/messaging/conversations/[conversationId]/prefs/route.ts')
const presence = read('app/api/messaging/conversations/[conversationId]/presence/route.ts')
const globalPresence = read('app/api/messaging/presence/route.ts')
const messagingPreferences = read('app/api/messaging/preferences/route.ts')
const ensureMember = read('app/api/messaging/conversations/[conversationId]/ensure-member/route.ts')
const readReceipt = read('app/api/messaging/conversations/[conversationId]/read/route.ts')
const sync = read('lib/messaging/server-messaging-sync.ts')
const context = read('contexts/ghc-context.tsx')
const failures = []
let total = 0
function check(condition, label) {
  total += 1
  if (condition) console.log(`PASS ${label}`)
  else failures.push(label)
}

// Inbox information architecture and prioritisation.
check(screen.includes('"archived"') && screen.includes('filter === "archived"'), 'archived conversations have a dedicated inbox lane')
check(screen.includes('count: archivedCount') && screen.includes('No archived conversations'), 'archive lane exposes count and a useful empty state')
check(screen.includes('rows.filter((c) => !c.isArchived)'), 'active inbox lanes exclude archived conversations')
check(screen.includes('rows.filter((c) => Boolean(c.isArchived))'), 'archived lane contains only archived conversations')
check(screen.includes('"communities", "archived"'), 'keyboard filter order includes archived lane')

// Draft reliability: preserve on app navigation, thread close and reconnect; clear only when composer is empty after send.
check(screen.includes('localStorage.getItem(`ghc.message-draft.${selectedId}`)'), 'conversation-specific drafts restore on thread open')
check(screen.includes('localStorage.setItem(key, draft)'), 'conversation-specific drafts persist as the user types')
check(screen.includes('if (draft.trim()) window.localStorage.setItem(key, draft)\n      else window.localStorage.removeItem(key)'), 'empty composer clears only its own persisted draft')
check(!/const onReconcile = \(\) => \{[\s\S]{0,180}setDraft\(""\)/.test(screen), 'network reconciliation does not erase unsent drafts')
check(!/if \(typeof tab === "string" && tab !== "messages"\) \{[\s\S]{0,160}setDraft\(""\)/.test(screen), 'leaving Messages does not erase unsent drafts')
check(!/const closeThread = useCallback\(\(\) => \{[\s\S]{0,180}setDraft\(""\)/.test(screen), 'closing a thread preserves its draft')
check(!screen.includes('localStorage.removeItem(`ghc.message-draft.${selectedId}`)'), 'switching threads does not delete the previous thread draft')

// Mobile and assistive-technology interaction quality.
check(parts.includes('flex gap-2 border-t border-gray-50 px-3 py-2 transition sm:hidden'), 'conversation actions are visible on touch layouts')
check(parts.includes('sm:group-focus-within:flex'), 'conversation actions can be revealed by keyboard focus')
check(parts.includes('aria-label={`${conversation.isArchived ? "Restore" : "Archive"} ${displayName}`}'), 'archive action has a contextual accessible name')
check(parts.includes('maxLength={8000}') && parts.includes('messageText.length}/8000'), 'composer enforces and exposes the server message length limit')
check(parts.includes('aria-describedby="message-composer-hint"'), 'composer instructions and character limit are associated with the input')
check(parts.includes('role="group"') && !parts.includes('role="button"\n          tabIndex={0}\n          onTouchStart={startLongPress}'), 'message bubbles no longer expose false button semantics')
check(parts.includes('sm:group-focus-within:opacity-100') && parts.includes('opacity-100 transition sm:opacity-0'), 'message actions remain available on touch and keyboard')
check(parts.includes('aria-label="More message actions"'), 'message action sheet has an explicit trigger name')

// Preserve server authority and private media controls.
check(conversations.includes('resolveAuthenticatedUser') && conversations.includes('auth.userId'), 'conversation APIs derive identity from the authenticated session')
check(store.includes('export async function isMember') && store.includes('left_at=is.null'), 'durable store checks active conversation membership')
check(messages.includes('resolveAuthenticatedUser') && messages.includes('auth.userId'), 'message read/write APIs use authenticated identity')
check(messages.includes('validateOwnedMediaAttachments') && messages.includes('ownerId: auth.userId'), 'message attachments remain owner-validated first-party media')
check(messages.includes('clientMessageId') && store.includes('client_message_id'), 'message sends retain idempotency protection')
check(messages.includes('checkDurableRateLimit') && messages.includes('{ onUnavailable: "deny" }'), 'message send/read rate limits fail closed on control-plane outage')
check(prefs.includes('resolveAuthenticatedUser') && prefs.includes('auth.userId'), 'personal conversation preferences remain session-scoped')
check(prefs.includes('setConversationPrefs'), 'pin/archive/mute preferences use the canonical server store')
check(conversations.includes('checkDurableRateLimit') && conversations.includes('onUnavailable: "deny"'), 'conversation creation uses durable fail-closed rate limiting')
check(prefs.includes('checkDurableRateLimit') && prefs.includes('onUnavailable: "deny"'), 'inbox preference writes use durable fail-closed rate limiting')
check(presence.includes('checkDurableRateLimit') && presence.includes('onUnavailable: "deny"'), 'conversation presence reads and writes use durable fail-closed rate limiting')
check(globalPresence.includes('checkDurableRateLimit') && globalPresence.includes('onUnavailable: "deny"'), 'global presence heartbeat uses durable fail-closed rate limiting')
check((messagingPreferences.match(/await checkDurableRateLimit/g) || []).length === 2 && messagingPreferences.includes('onUnavailable: "deny"'), 'messaging privacy preference reads and writes use durable fail-closed rate limiting')
check(ensureMember.includes('checkDurableRateLimit') && ensureMember.includes('onUnavailable: "deny"'), 'community membership provisioning uses durable fail-closed rate limiting')
check(readReceipt.includes('checkDurableRateLimit') && readReceipt.includes('onUnavailable: "deny"'), 'read receipts use durable fail-closed rate limiting')
check((presence.match(/await checkDurableRateLimit/g) || []).length === 2, 'both conversation presence operations use durable rate limiting')
check(sync.includes('apiSetConversationPrefs') && sync.includes('method: "PATCH"'), 'client preference mutations use the authenticated server preference endpoint')
check(context.includes('apiSetConversationPrefs(conversationId, { isPinned: true })') && context.includes('apiSetConversationPrefs(conversationId, { isPinned: false })'), 'pin and unpin persist explicit server-side states')
check(context.includes('apiSetConversationPrefs(conversationId, { isArchived: true })') && context.includes('apiSetConversationPrefs(conversationId, { isArchived: false })'), 'archive and restore persist explicit server-side states')
check(context.includes('apiSetConversationPrefs(conversationId, { mutedUntil })') && context.includes('apiSetConversationPrefs(conversationId, { mutedUntil: null })'), 'mute and unmute persist explicit server-side expiry states')
check(store.includes('select=conversation_id,gh_user_id,is_pinned,is_archived,muted_until') && store.includes('isMuted: muteUntil !== null && muteUntil > Date.now()'), 'server inbox hydration includes viewer-scoped mute state')
check(context.includes('isArchived: r.isArchived') && context.includes('isMuted: remote.isMuted'), 'initial and periodic inbox hydration reconcile durable preferences')
check(screen.includes('messaging.unpinConversation') && screen.includes('messaging.unarchiveConversation') && screen.includes('messaging.unmuteConversation'), 'inbox controls call the correct inverse action for restored/unmuted states')

// Release wiring and repository identity.
check(pkg.version === lock.version && pkg.version === lock.packages?.['']?.version, 'package and lockfile versions agree')
check(release.includes(`APP_RELEASE_VERSION = "${pkg.version}"`), 'in-app release identity matches package')
const versionAtLeast = (actual, minimum) => actual.split('.').map(Number).reduce((result, part, index, parts) => result || (part === Number(minimum.split('.')[index]) ? 0 : part > Number(minimum.split('.')[index]) ? 1 : -1), 0) >= 0
check(versionAtLeast(pkg.version, '0.330.38'), 'Priority 8 hardening remains preserved in releases from Phase 9.4 onward')
check(pkg.scripts['check:priority8-messaging'] === 'node scripts/check-priority8-messaging-transformation.mjs', 'dedicated Priority 8 messaging verification command is available')
for (const key of ['prebuild', 'verify:static']) check(pkg.scripts[key].includes('check-priority8-messaging-transformation.mjs'), `${key} runs the Priority 8 messaging gate`)

if (failures.length) {
  console.error(`\nPriority 8 Messages transformation: ${failures.length}/${total} failed`)
  for (const failure of failures) console.error(`FAIL ${failure}`)
  process.exit(1)
}
console.log(`\nPriority 8 Messages transformation: ${total}/${total} checks passed.`)
