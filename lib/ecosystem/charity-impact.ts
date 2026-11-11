export type CharityContributionView = {
  id: string
  amountAtomic: string
  campaignKey: string
  reason: string
  createdAt: string
}

export type CharityImpactSummary = {
  totalAtomic: string
  contributionCount: number
  items: CharityContributionView[]
  withdrawable: false
  segregated: true
}

function atomicString(value: unknown): string | null {
  if (typeof value === "number" && (!Number.isSafeInteger(value) || value < 0)) return null
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "bigint") return null
  const raw = String(value).trim()
  if (!/^\d{1,38}$/.test(raw)) return null
  try {
    const parsed = BigInt(raw)
    return parsed >= 0n ? parsed.toString() : null
  } catch { return null }
}

function safeText(value: unknown, max: number, fallback = ""): string {
  if (typeof value !== "string") return fallback
  const text = value.normalize("NFKC").trim()
  if (text.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) return fallback
  return text
}

/** Sanitizes the authenticated user's canonical charity summary for display. */
export function normalizeCharityImpactSummary(raw: unknown): CharityImpactSummary | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  const summary = raw as Record<string, unknown>
  if (summary.ok !== true) return null
  const totalAtomic = atomicString(summary.totalAtomic)
  if (totalAtomic === null) return null
  const rawCount = typeof summary.contributionCount === "number"
    ? summary.contributionCount
    : typeof summary.contributionCount === "string" && /^\d{1,12}$/.test(summary.contributionCount)
      ? Number(summary.contributionCount)
      : Number.NaN
  if (!Number.isSafeInteger(rawCount) || rawCount < 0 || !Array.isArray(summary.items)) return null
  const contributionCount = rawCount
  const rawItems = summary.items.slice(0, 20)
  const items: CharityContributionView[] = []
  for (const value of rawItems) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue
    const row = value as Record<string, unknown>
    const id = safeText(row.id, 64)
    const amount = atomicString(row.amount_atomic)
    const createdAtMs = typeof row.created_at === "string" ? Date.parse(row.created_at) : Number.NaN
    if (!/^[0-9a-f-]{36}$/i.test(id) || amount === null || BigInt(amount) <= 0n || !Number.isFinite(createdAtMs)) continue
    if (row.status !== "recorded") continue
    items.push({
      id,
      amountAtomic: amount,
      campaignKey: safeText(row.campaign_key, 80, "general") || "general",
      reason: safeText(row.reason, 120, "Charity contribution") || "Charity contribution",
      createdAt: new Date(createdAtMs).toISOString(),
    })
  }
  items.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return { totalAtomic, contributionCount, items, withdrawable: false, segregated: true }
}

/** Exact seven-decimal PI formatting from atomic units; never uses float math. */
export function formatPiAtomic(value: unknown): string {
  const atomic = atomicString(value)
  if (atomic === null) return "0.0000000"
  const amount = BigInt(atomic)
  const whole = amount / 10_000_000n
  const fraction = (amount % 10_000_000n).toString().padStart(7, "0")
  return `${whole.toString()}.${fraction}`
}
