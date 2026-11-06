/** Strict parser for privileged membership rows. Invalid paid rows fail closed. */
export type ParsedMembershipEntitlement = {
  userId: string
  tier: "free" | "vip" | "vvip"
  active: boolean
  startedAt: number
  expiresAt?: number
  billingPeriod?: "monthly" | "four_months" | "eight_months" | "yearly" | "comp"
  source: "default" | "ghc" | "pi" | "external" | "comp" | "admin" | "verified_payment"
  purchaseRef?: string
  paymentIntentId?: string
  updatedAt: number
  audit: Array<{ at: number; action: string; detail?: string }>
}

const TIERS = new Set(["free", "vip", "vvip"])
const SOURCES = new Set(["default", "ghc", "pi", "external", "comp", "admin", "verified_payment"])
const PERIODS = new Set(["monthly", "four_months", "eight_months", "yearly", "comp"])

function timestamp(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value
  if (typeof value === "string" && value.trim()) {
    const parsed = Date.parse(value)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }
  return undefined
}

export function parseMembershipEntitlementRow(
  row: Record<string, unknown>,
  requestedUserId: string,
  now = Date.now(),
): ParsedMembershipEntitlement {
  const userId = String(row.user_id ?? row.userId ?? "").trim()
  if (!userId || userId !== requestedUserId) throw new Error("MEMBERSHIP_ROW_IDENTITY_INVALID")

  const tier = String(row.tier ?? "").toLowerCase()
  if (!TIERS.has(tier)) throw new Error("MEMBERSHIP_ROW_TIER_INVALID")

  if (typeof row.active !== "boolean") throw new Error("MEMBERSHIP_ROW_ACTIVE_INVALID")
  const source = String(row.source ?? "").toLowerCase()
  if (!SOURCES.has(source)) throw new Error("MEMBERSHIP_ROW_SOURCE_INVALID")

  const periodRaw = row.billing_period ?? row.billingPeriod
  const billingPeriod = periodRaw == null || periodRaw === "" ? undefined : String(periodRaw).toLowerCase()
  if (billingPeriod && !PERIODS.has(billingPeriod)) throw new Error("MEMBERSHIP_ROW_PERIOD_INVALID")

  const startedAt = timestamp(row.started_at ?? row.startedAt)
  const updatedAt = timestamp(row.updated_at ?? row.updatedAt)
  if (!updatedAt) throw new Error("MEMBERSHIP_ROW_UPDATED_AT_INVALID")
  if (tier !== "free" && !startedAt) throw new Error("MEMBERSHIP_ROW_STARTED_AT_INVALID")

  const expiresRaw = row.expires_at ?? row.expiresAt
  const expiresAt = expiresRaw == null || expiresRaw === "" ? undefined : timestamp(expiresRaw)
  if (expiresRaw != null && expiresRaw !== "" && !expiresAt) {
    throw new Error("MEMBERSHIP_ROW_EXPIRY_INVALID")
  }
  if (tier !== "free") {
    const perpetualComp = source === "comp" || billingPeriod === "comp"
    if (!expiresAt && !perpetualComp) throw new Error("MEMBERSHIP_PAID_EXPIRY_MISSING")
    if (expiresAt && startedAt && expiresAt <= startedAt) throw new Error("MEMBERSHIP_ROW_EXPIRY_RANGE_INVALID")
  }

  const audit = Array.isArray(row.audit)
    ? row.audit.slice(-40).flatMap((entry) => {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) return []
        const item = entry as Record<string, unknown>
        const at = timestamp(item.at)
        const action = typeof item.action === "string" ? item.action.trim().slice(0, 80) : ""
        if (!at || !action) return []
        const detail = typeof item.detail === "string" ? item.detail.slice(0, 240) : undefined
        return [{ at, action, ...(detail ? { detail } : {}) }]
      })
    : []

  let normalizedTier = tier as ParsedMembershipEntitlement["tier"]
  let normalizedSource = source as ParsedMembershipEntitlement["source"]
  let normalizedActive = row.active
  const normalizedAudit = [...audit]
  if (normalizedTier !== "free" && (!normalizedActive || (expiresAt !== undefined && expiresAt <= now))) {
    normalizedTier = "free"
    normalizedActive = true
    normalizedSource = "default"
    normalizedAudit.push({ at: now, action: "EXPIRED_OR_INACTIVE", detail: tier })
  }

  return {
    userId,
    tier: normalizedTier,
    active: normalizedActive,
    startedAt: startedAt ?? now,
    ...(expiresAt !== undefined ? { expiresAt } : {}),
    ...(billingPeriod ? { billingPeriod: billingPeriod as ParsedMembershipEntitlement["billingPeriod"] } : {}),
    source: normalizedSource,
    ...(typeof row.purchase_ref === "string" && row.purchase_ref.trim() ? { purchaseRef: row.purchase_ref.trim() } : {}),
    ...(typeof row.payment_intent_id === "string" && row.payment_intent_id.trim() ? { paymentIntentId: row.payment_intent_id.trim() } : {}),
    updatedAt,
    audit: normalizedAudit.slice(-40),
  }
}
