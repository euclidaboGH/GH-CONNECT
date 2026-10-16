/**
 * Avatar resolution — CDN-ready with safe local fallbacks.
 */

const FALLBACK = "/placeholder-user.jpg"
const PLACEHOLDER_SVG = "/placeholder.svg?height=320&width=320"

/** DiceBear (public) styles for deterministic demo avatars without local /avatars files. */
const DICEBEAR = "https://api.dicebear.com/7.x/avataaars/svg"

export type AvatarOptions = {
  /** Seed for deterministic generated avatar (name or user id). */
  seed?: string
  size?: number
  /** Prefer generated CDN avatar when no photo provided. */
  preferGenerated?: boolean
}

/**
 * Resolve a displayable avatar URL.
 * Priority: valid http(s)/data/blob photo → generated CDN → local placeholder.
 */
export function resolveAvatarUrl(
  photo?: string | null,
  options: AvatarOptions = {}
): string {
  const { seed, size = 128, preferGenerated = true } = options

  if (typeof photo === "string" && photo.trim()) {
    const value = photo.trim()
    if (
      value.startsWith("https://") ||
      value.startsWith("http://") ||
      value.startsWith("data:") ||
      value.startsWith("blob:") ||
      value.startsWith("/")
    ) {
      // Missing local /avatars/* → fall through to generated/placeholder
      if (value.startsWith("/avatars/")) {
        /* continue */
      } else {
        return value
      }
    }
  }

  if (preferGenerated && seed) {
    const q = new URLSearchParams({
      seed: String(seed).slice(0, 64),
      size: String(size),
    })
    return `${DICEBEAR}?${q.toString()}`
  }

  return FALLBACK
}

export function avatarInitials(name?: string | null): string {
  if (!name || typeof name !== "string") return "?"
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

export const AVATAR_FALLBACK = FALLBACK
export const AVATAR_PLACEHOLDER = PLACEHOLDER_SVG
