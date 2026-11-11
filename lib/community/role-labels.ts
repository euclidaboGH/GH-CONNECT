/**
 * Phase 8 — consistent community role & privacy labels (presentation only).
 */

export type CommunityRoleLabel = "owner" | "admin" | "moderator" | "member" | "guest"

export function formatCommunityRole(role: string | null | undefined): string {
  const r = String(role || "").toLowerCase()
  switch (r) {
    case "owner":
      return "Owner"
    case "admin":
      return "Admin"
    case "moderator":
    case "mod":
      return "Moderator"
    case "member":
      return "Member"
    case "guest":
      return "Guest"
    default:
      return r ? r.charAt(0).toUpperCase() + r.slice(1) : "Member"
  }
}

export function communityRoleBadgeClass(role: string | null | undefined): string {
  const r = String(role || "").toLowerCase()
  if (r === "owner") return "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
  if (r === "admin") return "bg-violet-100 text-violet-900 dark:bg-violet-950/40 dark:text-violet-200"
  if (r === "moderator" || r === "mod") return "bg-sky-100 text-sky-900 dark:bg-sky-950/40 dark:text-sky-200"
  if (r === "member") return "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200"
  return "bg-muted text-muted-foreground"
}

export function privacyJoinHint(privacy: string | null | undefined): string {
  const p = String(privacy || "public").toLowerCase()
  if (p === "private" || p === "approval" || p === "request") {
    return "This community reviews join requests. You may need approval before posting."
  }
  if (p === "invite-only" || p === "invite") {
    return "Invite-only — you need an invitation from a member or admin."
  }
  return "Public community — you can join and participate when membership is confirmed."
}
