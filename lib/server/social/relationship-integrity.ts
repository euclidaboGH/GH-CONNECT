/**
 * Phase 8 — Profile & Matching relationship integrity.
 * Actor is always the authenticated session user. Client actor/follower IDs are ignored.
 */

export function sanitizeTargetUserId(raw: unknown, actorId: string): { ok: true; targetUserId: string } | { ok: false; error: string } {
  const target = String(raw || "").trim()
  if (!target || target.length > 160 || /[\u0000-\u001f\u007f]/.test(target)) {
    return { ok: false, error: "TARGET_REQUIRED" }
  }
  if (target === String(actorId || "").trim()) {
    return { ok: false, error: "SELF" }
  }
  // Block obvious demo placeholders from being treated as real peers
  if (/^(demo|sample|placeholder)[-_]/i.test(target) || target === "me") {
    return { ok: false, error: "INVALID_TARGET" }
  }
  return { ok: true, targetUserId: target }
}

export function humanizeRelationshipError(code: string): string {
  switch (String(code || "").toUpperCase()) {
    case "SELF":
      return "You cannot follow, connect, or match with yourself."
    case "BLOCKED":
      return "This action is blocked between these accounts."
    case "TARGET_REQUIRED":
      return "Choose a valid person to continue."
    case "INVALID_TARGET":
      return "That account cannot be used for this action."
    case "INVALID_SIGNAL":
      return "Use Interest, Pass, or Super interest only."
    case "RATE_LIMITED":
      return "Too many relationship actions. Please wait and try again."
    case "ALREADY_CONNECTED":
      return "You are already connected."
    case "PENDING_EXISTS":
      return "A connection request is already pending."
    case "UNAUTHORIZED":
    case "AUTH_REQUIRED":
      return "Sign in to manage follows, connections, and matches."
    default:
      return "Could not update this relationship. Please try again."
  }
}

export const RELATIONSHIP_PHASE = "8-profile-matching" as const
