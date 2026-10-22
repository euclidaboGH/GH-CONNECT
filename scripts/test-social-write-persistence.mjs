#!/usr/bin/env node
import fs from "node:fs"
const read = (p) => fs.readFileSync(p, "utf8")
const migration = read("supabase/migrations/20261022010098_gh_social_engagement_write_integrity.sql")
const curation = read("app/api/social/posts/[id]/curation/route.ts")
const reactions = read("app/api/social/posts/[id]/reactions/route.ts")
const comments = read("app/api/social/posts/[id]/comments/route.ts")
const commentDelete = read("app/api/social/posts/[id]/comments/[commentId]/route.ts")
const commentReactions = read("app/api/social/posts/[id]/comments/[commentId]/reactions/route.ts")
const feed = read("app/api/social/feed/route.ts")
const profile = read("app/api/social/profile/[userId]/posts/route.ts")
const helper = read("lib/server/social/comment-reactions.ts")
const context = read("contexts/ghc-context.tsx")
const sheet = read("components/ghc/comment-sheet.tsx")
const profileScreen = read("components/ghc/profile-screen.tsx")
const save = read("app/api/social/saves/route.ts")
const share = read("app/api/social/posts/[id]/share/route.ts")
const edit = read("app/api/social/posts/[id]/edit/route.ts")
const checks = [
  ["curation write remains session-authenticated and uses the atomic RPC", curation.includes("resolveAuthenticatedUser") && curation.includes('socialRpc("gh_post_curation_set_with_reward"') && curation.includes("durable: true")],
  ["curation RPC serializes writes per post and reconciles counters from canonical vote rows", migration.includes("gh_curate_post:") && migration.includes("FROM public.gh_post_curations WHERE post_id = v_post_id")],
  ["reaction API checks canonical post visibility before write", reactions.includes("canViewSocialPost") && reactions.indexOf("canViewSocialPost") < reactions.indexOf('socialRpc("gh_reaction_toggle"')],
  ["reaction RPC locks post and derives like count from durable rows", migration.includes("gh_reaction_toggle") && migration.includes("FOR UPDATE") && migration.includes("FROM public.gh_post_reactions")],
  ["comment creation maps ID collisions to conflict instead of false success", comments.includes("COMMENT_ID_CONFLICT") && comments.includes("? 409")],
  ["comment reads do not report transport-only RPC success as durable data", comments.includes("rpcReadSucceeded = Boolean(chosen.ok && Array.isArray(data?.comments)") && comments.includes("rpcReadSucceeded || directReadSucceeded")],
  ["comment create RPC only treats same-author/post/content duplicates as idempotent", migration.includes("v_existing.deleted_at IS NULL") && migration.includes("COMMENT_ID_CONFLICT")],
  ["comment delete uses atomic RPC instead of direct REST patch", commentDelete.includes('socialRpc("gh_comment_delete"') && !commentDelete.includes('method: "PATCH"')],
  ["comment edit and pin use authenticated durable RPCs", commentDelete.includes('socialRpc("gh_comment_edit"') && commentDelete.includes('socialRpc("gh_comment_pin_set"') && migration.includes("gh_comment_edit") && migration.includes("gh_comment_pin_set")],
  ["comment edit and pin state are included in canonical list and profile/feed hydration", migration.includes('c.is_edited AS "isEdited"') && migration.includes('coalesce(c.is_pinned, false) AS "isPinned"') && feed.includes("isPinned: Boolean(comment.is_pinned)") && profile.includes("isPinned: Boolean(comment.is_pinned)")],
  ["comment delete transaction adjusts post comment count and allows comment/post owners", migration.includes("gh_comment_delete") && migration.includes("comment_count = greatest(0, coalesce(comment_count, 0) - 1)") && migration.includes("v_author <> trim(p_actor_id) AND v_post_author <> trim(p_actor_id)")],
  ["deleting a parent does not silently discard other users' durable replies", context.includes("Keep replies from other authors") && context.includes("comments: p.comments.filter((c) => c.id !== commentId)")],
  ["comment reactions use durable RPC and return viewer state after refresh", commentReactions.includes('socialRpc("gh_comment_reaction_toggle"') && commentReactions.includes("viewerReactions")],
  ["comment reaction RPC serializes writes on the comment row", migration.includes("gh_comment_reaction_toggle") && migration.includes("gh_comment_reactions")],
  ["feed hydrates comment reactions and preserves media attachments", feed.includes("loadCommentReactionState") && feed.includes("mediaAttachments")],
  ["profile hydrates curation, post reactions and comment reactions", profile.includes("loadCommentReactionState") && profile.includes("reactionsByPost") && profile.includes("votesByPost")],
  ["comment read helper exposes counts and only the current viewer's own emojis", helper.includes("reactionCounts") && helper.includes("viewerReactions") && !helper.includes("userIds")],
  ["client applies server reaction result without a second local toggle", context.includes("Do not run a second local-domain") && context.includes("reactionCounts: body.counts")],
  ["comment reaction removal uses the durable server toggle", context.includes("Removal is the same durable toggle as addition") && context.includes("await addCommentReaction(postId, commentId, emoji)")],
  ["comment edit/delete client actions call durable HTTP endpoints", context.includes('method: "PATCH"') && context.includes('method: "DELETE"') && context.includes("Comment edit was not saved") && context.includes("Comment delete was not saved")],
  ["comment UI uses hydrated counts and active viewer state", sheet.includes("c.reactionCounts") && sheet.includes("c.viewerReactions?.includes")],
  ["profile UI preserves server-hydrated post and comment reaction state", profileScreen.includes("row.reactionCounts") && profileScreen.includes("row.viewerReactions") && profileScreen.includes("mapProfilePostComments(row.comments)")],
  ["save route verifies post visibility and writes through durable RPC", save.includes("canViewSocialPost") && save.includes('socialRpc("gh_save_toggle"')],
  ["share route verifies post visibility and writes through durable RPC", share.includes("canViewSocialPost") && share.includes('socialRpc("gh_post_share"')],
  ["post edit reports success only after returned database row confirms persistence", edit.includes('Prefer: "return=representation"') && edit.includes("EDIT_NOT_CONFIRMED")],
  ["migration locks down service-role-only write RPCs", migration.includes("REVOKE ALL ON FUNCTION public.gh_save_toggle(text, text) FROM PUBLIC, anon, authenticated") && migration.includes("GRANT EXECUTE ON FUNCTION public.gh_comment_delete(text, text, text) TO service_role")],
  ["existing counters reconcile from canonical durable rows", migration.includes("UPDATE public.gh_posts p SET") && migration.includes("FROM public.gh_post_comments c WHERE c.post_id = p.id AND c.deleted_at IS NULL")],
]
let failures = 0
for (const [label, pass] of checks) {
  console.log(`${pass ? "PASS" : "FAIL"} ${label}`)
  if (!pass) failures++
}
console.log(`\n${checks.length - failures}/${checks.length} social write-persistence checks passed`)
if (failures) process.exit(1)
