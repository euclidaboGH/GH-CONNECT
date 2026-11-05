#!/usr/bin/env node
/** Regression guards for bounded messaging API JSON parsing. */
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (path) => readFileSync(join(root, path), 'utf8')
const helper = read('lib/server/http/read-bounded-json.ts')
const messages = read('app/api/messaging/conversations/[conversationId]/messages/route.ts')
const conversations = read('app/api/messaging/conversations/route.ts')
const presence = read('app/api/messaging/conversations/[conversationId]/presence/route.ts')
const preferences = read('app/api/messaging/preferences/route.ts')
const readReceipt = read('app/api/messaging/conversations/[conversationId]/read/route.ts')
const conversationPrefs = read('app/api/messaging/conversations/[conversationId]/prefs/route.ts')
const checks = [
  ['shared parser rejects malformed content-length', helper.includes('!/^\\d+$/.test(declaredLength)')],
  ['shared parser checks declared body size before reading', helper.indexOf('parsedLength > maxBytes') < helper.indexOf('request.body.getReader()')],
  ['shared parser streams request bytes under a hard limit', helper.includes('request.body.getReader()') && helper.includes('totalBytes += value.byteLength') && helper.includes('totalBytes > maxBytes')],
  ['shared parser cancels oversized request streams immediately', helper.includes('reader.cancel("request body exceeds configured limit")')],
  ['shared parser validates safe max and declared lengths', helper.includes('Number.isSafeInteger(maxBytes)') && helper.includes('Number.isSafeInteger(parsedLength)')],
  ['shared parser strictly decodes UTF-8 before JSON parsing', helper.includes('new TextDecoder("utf-8", { fatal: true })')],
  ['shared parser rejects malformed JSON', helper.includes('error: "INVALID_JSON"')],
  ['shared parser rejects null, primitive and array payloads', helper.includes('!value || typeof value !== "object" || Array.isArray(value)')],
  ['message send uses 24 KiB bounded parser', messages.includes('readBoundedJson(request, 24 * 1024)')],
  ['message send returns explicit bounded-parser errors', messages.includes('const status = parsed.error === "REQUEST_TOO_LARGE" ? 413 : 400')],
  ['message edit uses 16 KiB bounded parser', messages.includes('readBoundedJson(request, 16 * 1024)')],
  ['conversation create uses 16 KiB bounded parser', conversations.includes('readBoundedJson(request, 16 * 1024)')],
  ['conversation create returns explicit bounded-parser errors', conversations.includes('parsed.error === "REQUEST_TOO_LARGE" ? 413 : 400')],
  ['message identity remains session-derived', messages.includes('senderId: auth.userId')],
  ['message attachments still pass owned-media validation', messages.includes('validateOwnedMediaAttachments')],
  ['message pagination cursor length and control characters are bounded at route boundary', messages.includes('before.length > 80') && messages.includes('beforeId.length > 180')],
  ['client message id is bounded and rejects control characters', messages.includes('INVALID_CLIENT_MESSAGE_ID') && messages.includes('clientMessageId.length > 180')],
  ['message send rate-limit response includes Retry-After', messages.includes('String(rl.retryAfterSec)')],
  ['pagination invalid cursor returns 400 without querying the store', messages.includes('error: "INVALID_CURSOR"') && messages.indexOf('error: "INVALID_CURSOR"') < messages.indexOf('const result = await listMessages')],
  ['conversation presence action uses bounded JSON parser', presence.includes('readBoundedJson(request, 2 * 1024)') && !presence.includes('request.json()')],
  ['messaging preferences use bounded JSON parser', preferences.includes('readBoundedJson(request, 4 * 1024)') && !preferences.includes('request.json()')],
  ['read receipts validate conversation IDs before store access', readReceipt.includes('INVALID_CONVERSATION_ID') && readReceipt.indexOf('INVALID_CONVERSATION_ID') < readReceipt.indexOf('const result = await markConversationRead')],
  ['read receipts are rate limited with Retry-After', readReceipt.includes('messaging-read-receipt:') && readReceipt.includes('Retry-After')],
  ['conversation preferences use bounded JSON parsing', conversationPrefs.includes('readBoundedJson(request, 4 * 1024)') && !conversationPrefs.includes('request.json()')],
  ['conversation preferences validate IDs before store access', conversationPrefs.includes('INVALID_CONVERSATION_ID') && conversationPrefs.indexOf('INVALID_CONVERSATION_ID') < conversationPrefs.indexOf('const result = await setConversationPrefs')],
  ['conversation preferences rate limit with Retry-After', conversationPrefs.includes('messaging-conversation-prefs-write:') && conversationPrefs.includes('Retry-After')],
  ['conversation preferences reject empty or invalid preference patches', conversationPrefs.includes('INVALID_PREFERENCE') && conversationPrefs.includes('!hasPinned && !hasArchived && !hasMutedUntil')],
  ['conversation mute timestamps reject non-finite, fractional and out-of-range values', conversationPrefs.includes('Number.isSafeInteger(body.mutedUntil)') && conversationPrefs.includes('body.mutedUntil > 8_640_000_000_000_000')],
]
let failed = 0
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  if (!ok) failed++
}
console.log(`\nMessaging bounded JSON checks: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
