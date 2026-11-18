/** Membership UX helpers. Entitlements and billing authority stay server-side. */
export function membershipTierLabel(tier: unknown): string {
  const t = String(tier || "").toLowerCase()
  if (t === "vvip") return "VVIP"
  if (t === "vip") return "VIP"
  if (t === "free" || !t) return "Free"
  return "Membership"
}

export function membershipActive(input: { active?: boolean; expiresAt?: number | null }): boolean {
  if (input.active === false) return false
  if (input.active === true) {
    if (input.expiresAt == null) return true
    return Number(input.expiresAt) > Date.now()
  }
  if (input.expiresAt != null && Number.isFinite(Number(input.expiresAt))) {
    return Number(input.expiresAt) > Date.now()
  }
  return false
}

export function membershipDaysRemaining(expiresAt: unknown): number | null {
  const n = Number(expiresAt)
  if (!Number.isFinite(n) || n <= 0) return null
  const ms = n - Date.now()
  if (ms <= 0) return 0
  return Math.ceil(ms / 86_400_000)
}

/** Generic fallback. Callers compare against this constant instead of a duplicated string. */
export const MEMBERSHIP_DEFAULT_ERROR = "Membership purchase failed"

export function humanizeMembershipError(code?: string, status?: number): string {
  const c = String(code || "").toUpperCase()
  if (c.includes("INSUFFICIENT") || status === 402) {
    return "Insufficient GHC balance. Earn or claim available GHC, then try again."
  }
  if (c.includes("ALREADY_ACTIVE") || c.includes("ALREADY_MEMBER")) {
    return "This membership is already active on your account."
  }
  if (c.includes("AUTH")) return "Sign in required to purchase membership."
  if (c.includes("STORE_UNAVAILABLE") || c.includes("DURABLE_WRITE")) {
    return "Membership could not be saved on the server. If GHC was spent, contact support with your receipt."
  }
  if (c.includes("SERVER_UNAVAILABLE") || status === 503) {
    return "Membership service is temporarily unavailable. Try again shortly."
  }
  if (c.includes("PRODUCT_MISMATCH") || c.includes("AMOUNT_MISMATCH")) {
    return "Payment does not match the selected plan. No entitlement was granted."
  }
  return MEMBERSHIP_DEFAULT_ERROR
}
