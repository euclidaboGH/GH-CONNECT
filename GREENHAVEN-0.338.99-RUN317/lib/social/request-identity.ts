/**
 * Stable, non-secret account scope for social request coalescing and stale-response guards.
 * Never include bearer tokens or session cookies in cache keys or diagnostics.
 */
export type SocialRequestIdentity = {
  userId?: string | null
  piUserId?: string | null
  authState?: string | null
}

export function buildSocialRequestIdentityKey(identity: SocialRequestIdentity): string {
  return [
    String(identity.userId || "current-user").trim() || "current-user",
    String(identity.piUserId || "").trim(),
    String(identity.authState || "unknown").trim(),
  ].join("::")
}

export function isSocialRequestIdentityCurrent(
  requestIdentityKey: string,
  currentIdentity: SocialRequestIdentity,
): boolean {
  return Boolean(requestIdentityKey) && requestIdentityKey === buildSocialRequestIdentityKey(currentIdentity)
}
