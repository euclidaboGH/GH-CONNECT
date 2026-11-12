/**
 * Phase 2 — Identity convergence helpers.
 * Compare user references across Pi UID, canonical app id, and alternate ids
 * without inventing identity or trusting client-only claims for money.
 */

import { IdentityService, isStudioPlaceholderId } from "@/lib/identity/identity-service"

function norm(id: string | null | undefined): string {
  return String(id || "").trim()
}

/** All known ids for the current session (deduped, no studio placeholders preferred last). */
export function getSessionIdentityAliases(): string[] {
  const snap = IdentityService.getIdentity()
  const raw = [
    snap.userId,
    snap.piUserId,
    (snap as { piUid?: string | null }).piUid,
  ]
  const out: string[] = []
  const seen = new Set<string>()
  for (const r of raw) {
    const id = norm(r)
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

/**
 * True when `candidate` refers to the same person as any of `aliases`.
 * Used for ownership filters (cart, listings) where sellerId may be Pi UID
 * while session userId was hydrated from a profile id (or the reverse).
 */
export function isSameIdentity(
  candidate: string | null | undefined,
  aliases?: string[] | null,
): boolean {
  const target = norm(candidate)
  if (!target || isStudioPlaceholderId(target)) return false
  const pool = aliases && aliases.length > 0 ? aliases : getSessionIdentityAliases()
  for (const a of pool) {
    if (a === target) return true
  }
  return false
}

/** Whether the current session owns a marketplace listing / cart line. */
export function isOwnedByCurrentUser(sellerId: string | null | undefined): boolean {
  return isSameIdentity(sellerId, getSessionIdentityAliases())
}

/**
 * True if `candidate` appears in `list`, or any session alias of `candidate`
 * appears when `candidate` is the current user (ownership / self checks).
 * For third parties, exact string match only — we do not invent their aliases.
 */
export function idListIncludes(
  list: readonly string[] | null | undefined,
  candidate: string | null | undefined,
): boolean {
  const id = norm(candidate)
  if (!id) return false
  const pool = list || []
  for (const raw of pool) {
    if (norm(raw) === id) return true
  }
  // Self: following/friends arrays may hold Pi UID while UI passes profile id.
  if (isSameIdentity(id)) {
    const aliases = getSessionIdentityAliases()
    for (const raw of pool) {
      const x = norm(raw)
      if (x && aliases.includes(x)) return true
    }
  }
  return false
}
