/**
 * Pi Network–aligned privacy & consent helpers.
 * Keep consent explicit, data-minimized, and user-controlled.
 */

export type ConsentKey =
  | "terms_of_use"
  | "privacy_policy"
  | "community_guidelines"
  | "optional_analytics"
  | "optional_personalized_discovery"

export type ConsentRecord = {
  key: ConsentKey
  accepted: boolean
  acceptedAt: number | null
  version: string
}

export const POLICY_VERSIONS = {
  terms_of_use: "2026-08-1",
  privacy_policy: "2026-08-1",
  community_guidelines: "2026-08-1",
  optional_analytics: "2026-08-1",
  optional_personalized_discovery: "2026-08-1",
} as const

const STORAGE_KEY = "ghc.consent.v1"

export const REQUIRED_CONSENTS: ConsentKey[] = [
  "terms_of_use",
  "privacy_policy",
  "community_guidelines",
]

export function defaultConsentState(): ConsentRecord[] {
  return (Object.keys(POLICY_VERSIONS) as ConsentKey[]).map((key) => ({
    key,
    accepted: false,
    acceptedAt: null,
    version: POLICY_VERSIONS[key],
  }))
}

export function loadConsents(): ConsentRecord[] {
  if (typeof window === "undefined") return defaultConsentState()
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultConsentState()
    const parsed = JSON.parse(raw) as ConsentRecord[]
    if (!Array.isArray(parsed)) return defaultConsentState()
    const defaults = defaultConsentState()
    return defaults.map((d) => {
      const found = parsed.find((p) => p.key === d.key)
      if (!found) return d
      // Force re-consent if policy version changed
      if (found.version !== d.version) return d
      return { ...d, ...found, version: d.version }
    })
  } catch {
    return defaultConsentState()
  }
}

export function saveConsents(records: ConsentRecord[]): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
  } catch {
    /* best effort */
  }
}

export function acceptConsents(keys: ConsentKey[]): ConsentRecord[] {
  const current = loadConsents()
  const now = Date.now()
  const next = current.map((c) =>
    keys.includes(c.key)
      ? { ...c, accepted: true, acceptedAt: now, version: POLICY_VERSIONS[c.key] }
      : c
  )
  saveConsents(next)
  return next
}

export function hasRequiredConsents(records?: ConsentRecord[]): boolean {
  const list = records ?? loadConsents()
  return REQUIRED_CONSENTS.every((key) =>
    list.some((r) => r.key === key && r.accepted && r.version === POLICY_VERSIONS[key])
  )
}

export type PrivacyAudience = "everyone" | "matches-only" | "followers" | "only-me"

export const DEFAULT_PRIVACY_CONTROLS = {
  profileVisibility: "everyone" as PrivacyAudience,
  whoCanMessage: "everyone" as PrivacyAudience,
  showOnlineStatus: true,
  showLastSeen: false,
  showDistance: true,
  allowStoryReplies: true,
  indexedInDiscovery: true,
}

/** Human-readable policy blurbs for onboarding / settings. */
export const POLICY_COPY: Record<ConsentKey, { title: string; summary: string }> = {
  terms_of_use: {
    title: "Terms of Use",
    summary:
      "You agree to use GreenHaven respectfully, follow Pi Network rules, and not abuse the platform.",
  },
  privacy_policy: {
    title: "Privacy Policy",
    summary:
      "We minimize data collection. Profile and chat data stay under your control; you can delete or export where supported.",
  },
  community_guidelines: {
    title: "Community Guidelines",
    summary:
      "No harassment, scams, hate, sexual content involving minors, or illegal activity. Violations may lead to blocks or bans.",
  },
  optional_analytics: {
    title: "Anonymous analytics (optional)",
    summary: "Help improve performance with privacy-preserving usage stats. You can turn this off anytime.",
  },
  optional_personalized_discovery: {
    title: "Personalized discovery (optional)",
    summary: "Use your interests to rank people you may like. Disable to see a neutral order.",
  },
}
