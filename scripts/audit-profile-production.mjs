#!/usr/bin/env node
/**
 * Focused production-readiness gate for Profile and connected social/economy flows.
 * Static checks only: these do not replace TypeScript, integration, or deployed smoke tests.
 */
import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), "utf8")
const exists = (file) => fs.existsSync(path.join(root, file))
const profile = read("components/ghc/profile-screen.tsx")
const ownership = read("lib/ownership.ts")
const nav = read("components/ghc/profile-more-nav.tsx")
const card = read("components/ghc/profile-components.tsx")
const feed = read("contexts/ghc-context.tsx")
const feedScreen = read("components/ghc/enhanced-feed-screen.tsx")
const walletApi = read("app/api/economy/wallet/[userId]/route.ts")
const profileApi = read("app/api/profile/me/route.ts")
const library = read("components/ghc/profile-content-library.tsx")
const profilePostsApi = read("app/api/social/profile/[userId]/posts/route.ts")
const libraryMigration = read("supabase/migrations/20261023_gh_profile_content_library.sql")
const checks = [
  ["Profile consumes canonical feed context", profile.includes("useGHCFeed")],
  ["Profile filters to posts owned by current profile", profile.includes("isOwnProfilePost(post.authorId, post.authorName, meId, p)")],
  ["Stable author ID takes precedence over display-name fallback", ownership.includes("if (id) {") && ownership.includes("return isOwnAuthor(null, authorName, profile)")],
  ["Profile renders canonical owner post card", profile.includes("<OwnPostCard")],
  ["Profile has a dedicated Posts section", profile.includes('aria-label="Your posts"')],
  ["Posts count uses owner-filtered collection", profile.includes("{posts.length} in current feed")],
  ["Dashboard is a distinct profile section", profile.includes('aria-label="Profile dashboard"')],
  ["Dashboard starts collapsed", profile.includes("useState(false)") && profile.includes("dashboardOpen")],
  ["Dashboard toggle exposes expanded state", profile.includes("aria-expanded={dashboardOpen}")],
  ["Dashboard toggle points to content", profile.includes('aria-controls="profile-dashboard-content"')],
  ["Dashboard content has a stable id", profile.includes('id="profile-dashboard-content"')],
  ["Media is not a separate profile activity tab", !profile.includes('label: "Media" as const')],
  ["Activity is not a separate profile activity tab", !profile.includes('label: "Activity" as const')],
  ["Profile communities are in dashboard content", profile.indexOf("<ProfileMyCommunities") > profile.indexOf('aria-label="Profile dashboard"')],
  ["Ecosystem hub is available from dashboard", profile.includes("<ProfileEcosystemHub")],
  ["Setup checklist is grouped into dashboard", profile.indexOf("<SetupChecklist") > profile.indexOf('id="profile-dashboard-content"')],
  ["More-navigation menu is grouped into dashboard", profile.indexOf("<ProfileMoreNav") > profile.indexOf('id="profile-dashboard-content"')],
  ["Wallet quick action remains available", profile.includes('aria-label="Wallet"')],
  ["Settings quick action remains available", profile.includes('aria-label="Settings"')],
  ["Profile edit entry point remains available", profile.includes("onClick={openEdit}")],
  ["Profile share action remains available", profile.includes("shareProfile()")],
  ["Profile completion guidance remains available", profile.includes("profileCompletion.percentage")],
  ["GreenHaven ID remains visible", profile.includes("{ghDisplay}")],
  ["Copy ID waits for clipboard result", profile.includes("await navigator.clipboard.writeText(ghDisplay)")],
  ["Photo uploads validate MIME type", profile.includes('!file.type.startsWith("image/")')],
  ["Photo uploads enforce a 4 MB limit", profile.includes("file.size > 4 * 1024 * 1024")],
  ["Photo reader failures are handled", profile.includes("reader.onerror")],
  ["Offline status is surfaced", profile.includes("You are offline")],
  ["Network listeners are removed on cleanup", profile.includes('removeEventListener("online", sync)') && profile.includes('removeEventListener("offline", sync)')],
  ["Profile dialogs support Escape", profile.includes('e.key !== "Escape"')],
  ["Photo sheet is an accessible modal", profile.includes('role="dialog"') && profile.includes("aria-modal=\"true\"")],
  ["Owner post cards receive like handler", profile.includes("onLike={(postId) => { void feed.likePost(postId) }}")],
  ["Owner post cards receive delete handler", profile.includes("onDelete={(postId) => { void feed.deletePost(postId) }}")],
  ["Owner post cards receive edit handler", profile.includes("onEdit={(postId, content) => { void feed.editPost(postId, content) }}")],
  ["Owner post cards receive archive handler", profile.includes("onArchive={(postId) => { void feed.archivePost(postId) }}")],
  ["Save failures are caught and reported", profile.includes('"Could not save post"')],
  ["Empty profile has a create-post action", profile.includes('detail: { mode: "post" }')],
  ["Comment action carries post context", profile.includes('action: "comment"')],
  ["Share action carries post context", profile.includes('action: "share"')],
  ["Insights action carries post context", profile.includes('action: "insights"')],
  ["Feed listens for profile post actions", feedScreen.includes('addEventListener("ghc:open-post", handleOpenPostAction)')],
  ["Feed routes profile comment action to comment overlay", feedScreen.includes('if (action === "comment")') && feedScreen.includes("openComments(postId)")],
  ["Feed routes profile share action to share overlay", feedScreen.includes('if (action === "share")') && feedScreen.includes("setSharePostId(postId)")],
  ["Feed routes profile insights action to insights panel", feedScreen.includes('if (action === "insights")') && feedScreen.includes("setInsightsPost(target)")],
  ["Profile update awaits persistence", profile.includes("await ghc.updateProfile(updates)")],
  ["Profile save reports success/failure to the modal", profile.includes("Promise<boolean>") && profile.includes("return false") && profile.includes("return true")],
  ["Edit modal awaits save before closing", card.includes("const saved = await onSave({") && card.includes("if (saved === false) return")],
  ["Edit modal prevents duplicate saves", card.includes("if (isSaving) return") && card.includes("disabled={isSaving}")],
  ["Edit modal cannot be dismissed by Escape while saving", card.includes('if (isSaving && event.key === "Escape") event.stopPropagation()')],
  ["Edit modal surfaces thrown save errors", card.includes("Could not save your profile. Please try again.")],
  ["Owner card component delegates to enhanced card", card.includes("<EnhancedPostCard")],
  ["Canonical feed exposes post deletion", feed.includes("deletePost: GHCContextType[\"deletePost\"]")],
  ["Canonical feed exposes post editing", feed.includes("editPost: GHCContextType[\"editPost\"]")],
  ["Canonical feed exposes post archiving", feed.includes("archivePost: GHCContextType[\"archivePost\"]")],
  ["Dashboard navigation includes rewards", nav.includes('id: "rewards"')],
  ["Dashboard navigation includes membership", nav.includes('id: "membership"')],
  ["Dashboard navigation includes creator studio", nav.includes('id: "creator-studio"')],
  ["Messaging screen exists", exists("components/ghc/message-screen.tsx")],
  ["Story section exists", exists("components/ghc/profile-story-section.tsx")],
  ["Rewards centre exists", exists("components/ghc/rewards-centre-screen.tsx")],
  ["Wallet screen exists", exists("components/ghc/premium-wallet-screen.tsx")],
  ["Reputation UI exists", exists("components/ghc/reputation-badge.tsx")],
  ["Reputation API exists", exists("app/api/social/reputation/route.ts")],
  ["Curation API exists", exists("app/api/social/posts/[id]/curation/route.ts")],
  ["Wallet API requires authenticated user", walletApi.includes("resolveAuthenticatedUser")],
  ["Wallet API enforces same-user ownership", walletApi.includes("requireSameUser(auth, userId)")],
  ["Profile API requires authenticated user", profileApi.includes("resolveAuthenticatedUser")],
  ["Profile API excludes client-controlled financial fields", profileApi.includes("delete input.balance") && profileApi.includes("delete input.membership")],
  ["Profile content library component exists", exists("components/ghc/profile-content-library.tsx")],
  ["Owner profile links to content library", profile.includes("<ProfileContentLibrary") && profile.includes("setLibraryOpen(true)")],
  ["Peer profile links to public content library", exists("components/ghc/profile-preview-page.tsx") && read("components/ghc/profile-preview-page.tsx").includes("setShowContentLibrary(true)")],
  ["Library offers posts/photos/videos/documents/history filters", ["Posts", "Photos", "Videos", "Documents", "Profile history"].every((label) => library.includes(`label: "${label}"`))],
  ["Library searches post text and PDF titles", library.includes("Search posts, book titles or documents")],
  ["Library supports older content pagination", library.includes("Load older content") && library.includes("beforeId")],
  ["Library escapes unsafe attachment URL schemes", library.includes('parsed.protocol !== "https:"') && library.includes("!parsed.hostname") && !library.includes("href={post.pdf}")],
  ["Profile images use durable media upload first", profile.includes("uploadDurableMedia(file")],
  ["Profile history is bounded and persisted in profile payload", profile.includes(".slice(0, 24)") && profile.includes("profilePhotoHistory: history") && profile.includes("coverPhotoHistory: history")],
  ["Profile content API requires authenticated viewer", profilePostsApi.includes("resolveAuthenticatedUser")],
  ["Profile content API rate limits searches", profilePostsApi.includes("checkRateLimit(`profile-content:")],
  ["Profile content API derives viewer ID from session", profilePostsApi.includes("p_viewer_id: auth.userId") && !profilePostsApi.includes("p_viewer_id: url.searchParams")],
  ["Profile content API validates media filter and caps page size", profilePostsApi.includes("Math.min(50") && profilePostsApi.includes("allowedKinds")],
  ["Profile content RPC hides deleted and archived posts", libraryMigration.includes("p.deleted_at IS NULL") && libraryMigration.includes("p.archived_at IS NULL")],
  ["Profile content RPC respects blocks in either direction", libraryMigration.includes("b.blocker_id = trim(p_viewer_id)") && libraryMigration.includes("b.blocker_id = trim(p_profile_id)")],
  ["Profile content RPC respects post visibility", ["p.visibility = 'public'", "p.visibility = 'followers'", "p.visibility = 'mutuals'", "p.author_id = trim(p_viewer_id)"].every((part) => libraryMigration.includes(part))],
  ["Profile content RPC supports full-text substring search and content type filters", libraryMigration.includes("position(lower(v_query)") && libraryMigration.includes("v_kind = 'documents'")],
  ["Profile content RPC has stable paginated cursor", libraryMigration.includes("p_before_id text DEFAULT NULL") && libraryMigration.includes("'nextBeforeId'")],
  ["Profile content RPC execute permission is service-role only", libraryMigration.includes("REVOKE ALL ON FUNCTION public.gh_post_list_profile_content") && libraryMigration.includes("TO service_role")],
]

let failures = 0
for (const [label, pass] of checks) {
  if (pass) console.log(`PASS ${label}`)
  else {
    failures++
    console.error(`FAIL ${label}`)
  }
}
console.log(`\nProfile production audit: ${checks.length - failures}/${checks.length} passed`)
if (failures) process.exit(1)
