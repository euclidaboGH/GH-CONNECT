/**
 * Map server/API error codes to short, actionable user copy.
 * Never expose stack traces or internal RPC names.
 */

export function userFacingError(
  codeOrMessage: string | undefined | null,
  fallback = "Something went wrong. Please try again."
): string {
  const raw = String(codeOrMessage || "").trim()
  if (!raw) return fallback
  const c = raw.toUpperCase().replace(/\s+/g, "_")

  const map: Record<string, string> = {
    FORBIDDEN: "You don't have access to this chat. Rejoin the community or open it from Communities.",
    AUTH_REQUIRED: "Please sign in again to continue.",
    RATE_LIMITED: "You're going a bit fast — wait a moment and try again.",
    NOT_A_MEMBER: "Join this community first, then you can post and chat.",
    EMPTY_BODY: "Write a message or attach a photo first.",
    NETWORK: "Connection issue. Check your network and retry.",
    STORE_UNAVAILABLE: "Messaging is temporarily unavailable. Try again shortly.",
    MEDIA_STORAGE_UNAVAILABLE: "Photo upload isn't ready on the server yet. Try again in a moment.",
    INVALID_GREENHAVEN_ID: "That GreenHaven ID wasn't found. Check the spelling (e.g. GH-1JYHGG).",
    SELF_REFERRAL: "You can't list yourself as the person who invited you.",
    ALREADY_ATTRIBUTED: "Your referral is already locked in and can't be changed.",
    INVALID_CODE: "That referral code isn't valid.",
    JOIN_FAILED: "Couldn't join this community. Please try again.",
    SOCIAL_RPC_MISSING:
      "This action needs a database update. The operator must apply social engagement RPCs in Supabase.",
    SELF_CURATION_FORBIDDEN: "You can't upvote or downvote your own post.",
    COMMENT_FAILED: "Couldn't post that comment. Please try again.",
    SAVE_FAILED: "Couldn't save this post. Please try again.",
    CURATION_FAILED: "Couldn't record your vote. Please try again.",
    PARENT_NOT_FOUND: "That comment was removed. Refresh and try again.",
    POST_NOT_FOUND: "This post is no longer available.",
    CREATE_FAILED: "Couldn't create this. Please try again.",
    PRIVACY_RESTRICTED: "This person only accepts messages from connections.",
    BLOCKED: "Messaging isn't available with this account.",
  }

  if (map[c]) return map[c]
  // Prefer short human phrases already in the string
  if (raw.length < 120 && !/^[A-Z0-9_]+$/.test(raw)) return raw
  return fallback
}

export function toastError(message: string, type: "error" | "info" = "error") {
  try {
    window.dispatchEvent(
      new CustomEvent("ghc:toast", {
        detail: { message: userFacingError(message), type },
      })
    )
  } catch {
    /* */
  }
}
