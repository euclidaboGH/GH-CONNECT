#!/usr/bin/env node
/**
 * Incremental deep regression gate for profile/media and connected social/economy flows.
 * Static checks only; live auth, RLS, provider and production build gates remain separate.
 */
import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const read = (name) => fs.readFileSync(path.join(root, name), "utf8")
const exists = (name) => fs.existsSync(path.join(root, name))
const profile = read("components/ghc/profile-screen.tsx")
const preview = read("components/ghc/profile-preview-page.tsx")
const app = read("components/ghc/app.tsx")
const library = read("components/ghc/profile-content-library.tsx")
const stories = read("app/api/social/stories/route.ts")
const media = read("app/api/media/route.ts")
const mediaClient = read("lib/media/upload-client.ts")
const mediaPipeline = read("lib/media-pipeline.ts")
const conversations = read("app/api/messaging/conversations/route.ts")
const messages = read("app/api/messaging/conversations/[conversationId]/messages/route.ts")
const settings = read("components/ghc/settings.tsx")
const nav = read("components/ghc/profile-more-nav.tsx")
const feed = read("components/ghc/enhanced-feed-screen.tsx")
const feedContext = read("contexts/ghc-context.tsx")
const wallet = read("app/api/economy/wallet/[userId]/route.ts")
const rewards = read("app/api/economy/rewards/claim/route.ts")
const daily = read("app/api/economy/rewards/daily/route.ts")
const membership = read("app/api/membership/status/route.ts")
const reputation = read("app/api/social/reputation/route.ts")
const curation = read("app/api/social/posts/[id]/curation/route.ts")
const profileApi = read("app/api/profile/me/route.ts")
const contentApi = read("app/api/social/profile/[userId]/posts/route.ts")
const contentSql = read("supabase/migrations/20261022010102_gh_profile_content_library.sql")
const pkg = JSON.parse(read("package.json"))

const checks = [
  ["Owner profile includes media library", profile.includes("<ProfileContentLibrary")],
  ["Peer profile includes media library", preview.includes("<ProfileContentLibrary")],
  ["Global shell handles peer-profile open events", app.includes('addEventListener("ghc:open-profile"')],
  ["Peer profile overlay is mounted from shell", app.includes("<ProfilePreviewPageLazy")],
  ["Peer profile follow action is wired", app.includes("followUser(peerProfile.id)")],
  ["Peer profile message action is wired", app.includes("startConversation(target.id, target.name, target.photo)")],
  ["Peer profile block and report actions are wired", app.includes("blockUser(peerProfile.id)") && app.includes("reportUser(peerProfile.id, reason)")],
  ["Peer profile history props reach the content library", preview.includes("profilePhotoHistory={candidate.profilePhotoHistory") && preview.includes("coverPhotoHistory={candidate.coverPhotoHistory")],
  ["Peer profile avoids unsupported compatibility percentages", !preview.includes("% compatible") && !preview.includes("Compatibility")],
  ["Peer profile does not duplicate Like as a fake Connect action", !preview.includes("Connect interest") && !preview.includes("Link2")],
  ["Library distinguishes owner mode", profile.includes("isOwner")],
  ["Library search is server backed", library.includes("/api/social/profile/")],
  ["Posts tab remains a complete timeline including media posts", library.includes("The Posts tab is the chronological timeline")],
  ["Library cursor pagination is bounded", library.includes('limit: "30"')],
  ["Library aborts stale requests", library.includes("new AbortController()")],
  ["Library deduplicates posts by ID", library.includes("new Set(current.map((post) => post.id))")],
  ["Library validates HTTPS media URLs", library.includes('parsed.protocol !== "https:"')],
  ["Library rejects URL credentials", library.includes("parsed.username || parsed.password")],
  ["Library dialog declares modal semantics", library.includes('aria-modal="true"')],
  ["Library dialog has labelled title", library.includes('aria-labelledby="profile-content-library-title"')],
  ["Library restores focus after close", library.includes("previousFocusRef.current?.focus?.()")],
  ["Library suppresses referrer for remote media", library.includes('referrerPolicy="no-referrer"')],
  ["Library PDF links use noopener", library.includes('rel="noopener noreferrer"')],
  ["Content API derives viewer from auth", contentApi.includes("p_viewer_id: auth.userId")],
  ["Content API rate limits searches", contentApi.includes("checkRateLimit(`profile-content:${auth.userId}`")],
  ["Content API caps result count", contentApi.includes("Math.min(50")],
  ["Content API rejects malformed cursors", contentApi.includes("INVALID_CONTENT_CURSOR")],
  ["Content API responses are no-store", contentApi.includes('"Cache-Control": "no-store"')],
  ["Content SQL excludes deleted posts", contentSql.includes("p.deleted_at IS NULL")],
  ["Content SQL excludes archived posts", contentSql.includes("p.archived_at IS NULL")],
  ["Content SQL checks blocks in either direction", contentSql.includes("b.blocker_id = trim(p_profile_id)")],
  ["Content SQL hardens search path", contentSql.includes("SET search_path = pg_catalog, public, pg_temp")],
  ["Story list requires authenticated actor", stories.includes("resolveAuthenticatedUser(request.headers)")],
  ["Story list is rate limited", stories.includes("stories-list:${auth.userId}")],
  ["Story create is rate limited", stories.includes("stories-create:${auth.userId}")],
  ["Story text has explicit length limit", stories.includes("text.length > 2000")],
  ["Story request body has size guard", stories.includes("1024 * 1024")],
  ["Story media rejects unsafe URL schemes", stories.includes('parsed.protocol !== "https:"')],
  ["Story media rejects embedded credentials", stories.includes("parsed.username || parsed.password")],
  ["Story ID is server-generated", stories.includes("id: genId()") && !stories.includes('id: String(body.id')],
  ["Story owner name is session-derived", stories.includes("auth.username || \"Member\"") && !stories.includes("body.ownerName")],
  ["Story read failures return unavailable", stories.includes("STORY_LIST_UNAVAILABLE")],
  ["Story responses disable caching", stories.includes('"Cache-Control": "no-store"')],
  ["Media resolver requires auth", media.includes("resolveAuthenticatedUser(request.headers)")],
  ["Media resolver rate limits reads", media.includes("media-resolve:${auth.userId}")],
  ["Media resolver caps IDs", media.includes("rawIds.length > 20")],
  ["Media resolver rejects traversal-like IDs", media.includes('id.includes("..")')],
  ["Media resolver returns no-store", media.includes('"Cache-Control": "no-store"')],
  ["All media route JSON responses enforce no-store", media.includes("function jsonNoStore") && media.split("export async function GET")[1].includes("jsonNoStore(") && !media.split("export async function GET")[1].includes("NextResponse.json(")],
  ["Upload validates file signatures", media.includes("function sniffMime") && media.includes("const sniffedMime = sniffMime(head)")],
  ["Upload rejects MIME mismatch", media.includes("The file type does not match its contents")],
  ["Upload avoids exposing upstream storage detail", !media.includes("detail: detail.slice") && !media.includes("detail: record.error")],
  ["Primary upload helper guards Vercel request size", mediaClient.includes("file.size > 4 * 1024 * 1024")],
  ["Alternate media pipeline has same upload guard", mediaPipeline.includes("blob.size > 4 * 1024 * 1024")],
  ["Conversation listing caps page size", conversations.includes("Math.min(100, Math.max(1")],
  ["Conversation creation is rate limited", conversations.includes("conversation-create:${auth.userId}")],
  ["Conversation creation guards request size", conversations.includes("16 * 1024")],
  ["Message reads require auth", messages.includes("resolveAuthenticatedUser(request.headers)")],
  ["Message sends are rate limited", messages.includes("msg-send:${auth.userId}")],
  ["Message body length is bounded", messages.includes("text.length > 8000")],
  ["Message reads have per-user rate limits", messages.includes("msg-read:${auth.userId}")],
  ["Message edits have per-user rate limits", messages.includes("msg-edit:${auth.userId}")],
  ["Message deletes have per-user rate limits", messages.includes("msg-delete:${auth.userId}")],
  ["Message route validates conversation identifiers", messages.includes("INVALID_CONVERSATION_ID")],
  ["Message edit body length is bounded", messages.includes('const text = typeof body?.body === "string" ? body.body : ""') && messages.includes("text.length > 8000")],
  ["Profile navigation keeps creator tools", nav.includes('id: "creator-studio"')],
  ["Profile navigation keeps rewards", nav.includes('id: "rewards"')],
  ["Profile navigation keeps membership", nav.includes('id: "membership"')],
  ["Settings has settings-section deep link listener", settings.includes("ghc:open-settings-section")],
  ["Feed listens for profile post actions", feed.includes('addEventListener("ghc:open-post"')],
  ["Feed context exposes post edit/delete", feedContext.includes("editPost:") && feedContext.includes("deletePost:")],
  ["Wallet API enforces same-user access", wallet.includes("requireSameUser(auth, userId)")],
  ["Rewards claim route requires auth", rewards.includes("resolveAuthenticatedUser(request.headers)")],
  ["Daily rewards route requires auth", daily.includes("resolveAuthenticatedUser(request.headers)")],
  ["Membership status route requires auth", membership.includes("resolveAuthenticatedUser(request.headers)")],
  ["Reputation route has auth and rate limiting", reputation.includes("resolveAuthenticatedUser") && reputation.includes("checkRateLimit")],
  ["Curation route has auth and rate limiting", curation.includes("resolveAuthenticatedUser") && curation.includes("checkRateLimit")],
  ["Profile API strips client financial fields", profileApi.includes("delete input.balance") && profileApi.includes("delete input.membership")],
  ["Audit is wired into package scripts", pkg.scripts["audit:profile-connected-v2"] === "node scripts/audit-profile-connected-v2.mjs"],
  ["Existing release suite remains available", typeof pkg.scripts["test:release"] === "string"],
  ["Existing JSX gate remains prebuild", pkg.scripts.prebuild === "node scripts/check-jsx-safety.mjs"],
  ["Messaging API route exists", exists("app/api/messaging/conversations/[conversationId]/messages/route.ts")],
  ["Wallet API route exists", exists("app/api/economy/wallet/[userId]/route.ts")],
  ["Content library migration exists", exists("supabase/migrations/20261022010102_gh_profile_content_library.sql")],
]

let failed = 0
for (const [label, ok] of checks) {
  if (ok) console.log(`PASS ${label}`)
  else { failed++; console.error(`FAIL ${label}`) }
}
console.log(`\nConnected systems v2 audit: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
