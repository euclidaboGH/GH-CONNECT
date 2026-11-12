/**
 * Social content kinds — Post, Poll, Challenge, Story.
 * Presentation helpers only; does not award GHC.
 */

export type SocialContentKind = "post" | "poll" | "challenge" | "story"

export function resolvePostContentKind(post: {
  contentType?: string
  content?: string
  kind?: string
  type?: string
  isPoll?: boolean
  isChallenge?: boolean
  pollOptions?: unknown[]
}): SocialContentKind {
  const raw = String(post.kind || post.type || post.contentType || "").toLowerCase()
  if (raw.includes("poll") || post.isPoll || (Array.isArray(post.pollOptions) && post.pollOptions.length)) {
    return "poll"
  }
  if (raw.includes("challenge") || post.isChallenge) return "challenge"
  if (raw.includes("story")) return "story"
  const body = String(post.content || "")
  if (/^📊|^poll:/i.test(body) || body.includes("\n- [ ]") || body.includes("\n○ ")) return "poll"
  if (/^🏆|^challenge:/i.test(body)) return "challenge"
  return "post"
}

export function contentKindLabel(kind: SocialContentKind): string {
  switch (kind) {
    case "poll":
      return "Poll"
    case "challenge":
      return "Challenge"
    case "story":
      return "Story"
    default:
      return "Post"
  }
}

export function contentKindBadgeClass(kind: SocialContentKind): string {
  switch (kind) {
    case "poll":
      return "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-100"
    case "challenge":
      return "bg-rose-100 text-rose-900 dark:bg-rose-950/50 dark:text-rose-100"
    case "story":
      return "bg-violet-100 text-violet-900 dark:bg-violet-950/50 dark:text-violet-100"
    default:
      return "bg-muted text-muted-foreground"
  }
}
