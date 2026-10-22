#!/usr/bin/env node
/**
 * Static production-readiness regression gate for profile, media library and connected social/economy flows.
 * This complements, but does not replace, typecheck, lint, live authorization tests or a production build.
 */
import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), "utf8")
const exists = (file) => fs.existsSync(path.join(root, file))
const profile = read("components/ghc/profile-screen.tsx")
const preview = read("components/ghc/profile-preview-page.tsx")
const library = read("components/ghc/profile-content-library.tsx")
const contentApi = read("app/api/social/profile/[userId]/posts/route.ts")
const contentSql = read("supabase/migrations/20261022010102_gh_profile_content_library.sql")
const mediaApi = read("app/api/media/route.ts")
const uploadClient = read("lib/media/upload-client.ts")
const unifiedCompose = read("components/ghc/unified-compose.tsx")
const profileStory = read("components/ghc/profile-story-section.tsx")
const ownership = read("lib/ownership.ts")
const postCard = read("components/ghc/profile-components.tsx")
const feedContext = read("contexts/ghc-context.tsx")
const feedScreen = read("components/ghc/enhanced-feed-screen.tsx")
const walletApi = read("app/api/economy/wallet/[userId]/route.ts")
const profileApi = read("app/api/profile/me/route.ts")
const rewardsApi = read("app/api/economy/rewards/claim/route.ts")
const dailyRewardsApi = read("app/api/economy/rewards/daily/route.ts")
const membershipApi = read("app/api/membership/status/route.ts")
const reputationApi = read("app/api/social/reputation/route.ts")
const curationApi = read("app/api/social/posts/[id]/curation/route.ts")
const messageApi = read("app/api/messaging/conversations/[conversationId]/messages/route.ts")
const storyApi = read("app/api/social/stories/route.ts")
const nav = read("components/ghc/profile-more-nav.tsx")
const packageJson = read("package.json")
const checks = [
  ["Owner profile includes content library", profile.includes("<ProfileContentLibrary")],
  ["Peer profile includes content library", preview.includes("<ProfileContentLibrary")],
  ["Owner library is explicitly marked owner-only", profile.includes("isOwner")],
  ["Peer library uses candidate identity", preview.includes("profileId={candidate.id}")],
  ["Library has All/Posts/Photos/Videos/Documents/History views", ["All", "Posts", "Photos", "Videos", "Documents", "Profile history"].every((v) => library.includes(`label: \"${v}\"`))],
  ["Profile library search is server-backed", library.includes("/api/social/profile/") && library.includes("params.set(\"q\"")],
  ["Older profile content uses cursor pagination", library.includes("beforeId") && library.includes("Load older content")],
  ["Library uses bounded page size", library.includes('limit: "30"')],
  ["Library modal has dialog semantics", library.includes('role="dialog"') && library.includes('aria-modal="true"')],
  ["Library modal title is programmatically associated", library.includes("aria-labelledby=\"profile-content-library-title\"") && library.includes('id="profile-content-library-title"')],
  ["Library modal moves focus on open", library.includes("closeButtonRef.current?.focus()")],
  ["Library modal traps keyboard focus", library.includes("event.key !== \"Tab\"") && library.includes("last.focus()")],
  ["Library modal restores focus", library.includes("previousFocusRef.current?.focus?.()")],
  ["Library modal locks body scrolling", library.includes('document.body.style.overflow = "hidden"')],
  ["Library modal supports Escape dismissal", library.includes("event.key === \"Escape\"")],
  ["Library search fetch is abortable", library.includes("new AbortController()") && library.includes("signal: controller.signal")],
  ["Load-more requests are abortable", library.includes("loadMoreAbortRef.current?.abort()") && library.includes("signal: controller.signal")],
  ["Load-more deduplicates post IDs", library.includes("new Set(current.map((post) => post.id))")],
  ["External media URL parser requires HTTPS host", library.includes("parsed.protocol !== \"https:\"") && library.includes("!parsed.hostname")],
  ["External media URLs reject credentials", library.includes("parsed.username || parsed.password")],
  ["Embedded media data URLs have size bounds", library.includes("6 * 1024 * 1024") && library.includes("10 * 1024 * 1024")],
  ["Images suppress referrer leakage", library.includes('referrerPolicy="no-referrer"')],
  ["PDF external link has noopener protection", library.includes('rel="noopener noreferrer"')],
  ["Content API requires authenticated viewer", contentApi.includes("resolveAuthenticatedUser(request.headers)")],
  ["Content API derives viewer ID from authentication", contentApi.includes("p_viewer_id: auth.userId") && !contentApi.includes("p_viewer_id: url.searchParams")],
  ["Content API rate limits viewer searches", contentApi.includes("checkRateLimit(`profile-content:${auth.userId}`")],
  ["Content API validates profile ID length and controls", contentApi.includes("profileId.length > 160") && contentApi.includes("INVALID_PROFILE_ID")],
  ["Content API caps search query length", contentApi.includes('.slice(0, 120)')],
  ["Content API allow-lists media kinds", contentApi.includes('new Set(["all", "posts", "photos", "videos", "documents"])')],
  ["Content API rejects unsafe cursor numbers", contentApi.includes("Number.isSafeInteger(parsedBefore)")],
  ["Content API rejects malformed cursors", contentApi.includes("INVALID_CONTENT_CURSOR") && contentApi.includes("\\u0000-\\u001f")],
  ["Content API responses disable caching", contentApi.includes('"Cache-Control": "no-store"')],
  ["Content API page size is bounded to 50", contentApi.includes("Math.min(50, Math.max(1, Math.floor(limitRaw)))")],
  ["Profile content SQL uses SECURITY DEFINER", contentSql.includes("SECURITY DEFINER")],
  ["Profile content SQL has hardened search path", contentSql.includes("SET search_path = pg_catalog, public, pg_temp")],
  ["Profile content RPC is not executable by PUBLIC", contentSql.includes("REVOKE ALL ON FUNCTION public.gh_post_list_profile_content")],
  ["Profile content RPC is granted only to service role", contentSql.includes("TO service_role")],
  ["Profile content query excludes deleted posts", contentSql.includes("p.deleted_at IS NULL")],
  ["Profile content query excludes archived posts", contentSql.includes("p.archived_at IS NULL")],
  ["Profile content query hides blocks in either direction", contentSql.includes("b.blocker_id = trim(p_viewer_id)") && contentSql.includes("b.blocker_id = trim(p_profile_id)")],
  ["Profile content query always allows owner visibility", contentSql.includes("p.author_id = trim(p_viewer_id)")],
  ["Profile content query enforces follower visibility", contentSql.includes("p.visibility = 'followers'") && contentSql.includes("f.follower_id = trim(p_viewer_id)")],
  ["Profile content query enforces mutual visibility", contentSql.includes("p.visibility = 'mutuals'")],
  ["Profile content query searches PDF titles", contentSql.includes("coalesce(p.pdf_name, '')")],
  ["Profile content query filters media type", contentSql.includes("v_kind = 'documents'") && contentSql.includes("v_kind = 'videos'")],
  ["Profile content query uses stable timestamp+ID cursor", contentSql.includes("p_before_id IS NOT NULL") && contentSql.includes("p.id < p_before_id")],
  ["Profile content query has active author cursor index", contentSql.includes("idx_gh_posts_profile_library_cursor")],
  ["Media upload requires authenticated actor", mediaApi.includes("resolveAuthenticatedUser(request.headers)")],
  ["Media upload is rate-limited", mediaApi.includes("checkRateLimit(`media-upload:${auth.userId}`")],
  ["Media upload uses byte signature detection", mediaApi.includes("function sniffMime") && mediaApi.includes("const sniffedMime = sniffMime(head)")],
  ["Media upload rejects unknown signatures", mediaApi.includes("if (!sniffedMime)")],
  ["Media upload rejects MIME/signature mismatch", mediaApi.includes("The file type does not match its contents")],
  ["AVIF is not accidentally treated as MP4", mediaApi.includes("Do not classify every ISO-BMFF file as video") && mediaApi.includes("return null")],
  ["Media upload has request size guard", mediaApi.includes("REQUEST_TOO_LARGE") && mediaApi.includes("content-length")],
  ["Media upload has per-kind byte caps", mediaApi.includes("MAX_IMAGE_BYTES") && mediaApi.includes("MAX_VIDEO_BYTES") && mediaApi.includes("MAX_FILE_BYTES")],
  ["Profile image selection has file-size and type checks", profile.includes('!file.type.startsWith("image/")') && profile.includes("file.size > 25 * 1024 * 1024")],
  ["Profile photo history is bounded", profile.includes(".slice(0, 24)")],
  ["Profile update waits for persistence", profile.includes("await ghc.updateProfile?.(")],
  ["Durable upload helper avoids Vercel payload-limit requests", uploadClient.includes("SAFE_PROXY_UPLOAD_BYTES") && uploadClient.includes("uploadViaDirect")],
  ["Unified composer never persists blob URLs for video posts/stories", !unifiedCompose.includes("URL.createObjectURL(file)")],
  ["Profile story composer uses durable media upload", profileStory.includes("uploadDurableMedia") && profileStory.includes("uploaded.url")],
  ["Profile story composer does not create non-durable video URLs", !profileStory.includes("URL.createObjectURL(file)")],
  ["Owner posts use author-ID-first ownership", ownership.includes("if (id) {")],
  ["Owner posts use canonical enhanced post card", postCard.includes("<EnhancedPostCard")],
  ["Feed exposes post edit/delete/archive operations", feedContext.includes("deletePost:") && feedContext.includes("editPost:") && feedContext.includes("archivePost:")],
  ["Feed handles profile-originated post actions", feedScreen.includes('addEventListener("ghc:open-post", handleOpenPostAction)')],
  ["Feed routes profile comment/share/insights", feedScreen.includes('if (action === "comment")') && feedScreen.includes('if (action === "share")') && feedScreen.includes('if (action === "insights")')],
  ["Profile dashboard keeps rewards navigation", nav.includes('id: "rewards"')],
  ["Profile dashboard keeps membership navigation", nav.includes('id: "membership"')],
  ["Wallet API authenticates and enforces same-user access", walletApi.includes("resolveAuthenticatedUser") && walletApi.includes("requireSameUser(auth, userId)")],
  ["Profile API authenticates caller", profileApi.includes("resolveAuthenticatedUser")],
  ["Profile API strips client-controlled financial fields", profileApi.includes("delete input.balance") && profileApi.includes("delete input.membership")],
  ["Rewards claim route authenticates caller", rewardsApi.includes("resolveAuthenticatedUser")],
  ["Daily rewards route authenticates caller", dailyRewardsApi.includes("resolveAuthenticatedUser")],
  ["Membership status route authenticates caller", membershipApi.includes("resolveAuthenticatedUser")],
  ["Reputation API authenticates and rate-limits", reputationApi.includes("resolveAuthenticatedUser") && reputationApi.includes("checkRateLimit")],
  ["Curation API authenticates and rate-limits", curationApi.includes("resolveAuthenticatedUser") && curationApi.includes("checkRateLimit")],
  ["Messaging API authenticates caller", messageApi.includes("resolveAuthenticatedUser")],
  ["Story API exists and authenticates caller", exists("app/api/social/stories/route.ts") && storyApi.includes("resolveAuthenticatedUser")],
  ["Focused audit is wired into package scripts", packageJson.includes('"audit:profile"')],
  ["Static release verification remains available", packageJson.includes('"test:release"')],
  ["IDOR static gate remains available", packageJson.includes('"test:idor-static"')],
  ["JSX safety runs before production build", packageJson.includes('"prebuild": "node scripts/check-jsx-safety.mjs"')],
]

let failed = 0
for (const [label, ok] of checks) {
  if (ok) console.log(`PASS ${label}`)
  else { failed++; console.error(`FAIL ${label}`) }
}
console.log(`\nConnected profile production audit: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
