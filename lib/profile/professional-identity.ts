/**
 * Optional professional / business identity on the same GreenHaven account.
 * Does not create duplicate accounts. Verification badges only from backend flags.
 */

export type ProfileMode = "social" | "professional" | "business"

export type ProfessionalIdentity = {
  title?: string
  about?: string
  skills?: string[]
  education?: string[]
  experience?: Array<{
    role: string
    organization?: string
    from?: string
    to?: string | null
    summary?: string
  }>
  services?: string[]
  portfolio?: Array<{ title: string; url?: string; mediaUrl?: string; description?: string }>
  /** Structured location preferred when available */
  locationLabel?: string
  professionalInterests?: string[]
  communities?: string[]
  achievements?: string[]
  /** Contact preferences — never force public email */
  contactPreferences?: {
    allowInAppMessage?: boolean
    showProfessionOnSocial?: boolean
  }
  /**
   * Verification is server-authoritative only.
   * Client must not set true without profile.verified / server review.
   */
  professionalVerified?: boolean
}

export type BusinessIdentity = {
  businessName?: string
  category?: string
  about?: string
  services?: string[]
  locationLabel?: string
  hours?: string
  /** Server-only verification */
  businessVerified?: boolean
}

/** Safe merge — never invent verification */
export function mergeProfessionalPatch(
  current: ProfessionalIdentity | undefined,
  patch: Partial<ProfessionalIdentity>,
  opts?: { allowClientVerificationWrite?: boolean }
): ProfessionalIdentity {
  const next: ProfessionalIdentity = { ...(current || {}), ...patch }
  if (!opts?.allowClientVerificationWrite) {
    // Preserve existing flag only; ignore client attempts to self-verify
    next.professionalVerified = current?.professionalVerified === true
  }
  if (next.skills) next.skills = next.skills.slice(0, 40)
  if (next.portfolio) next.portfolio = next.portfolio.slice(0, 20)
  return next
}

export function profileModeLabel(mode: ProfileMode): string {
  if (mode === "professional") return "Professional"
  if (mode === "business") return "Business"
  return "Social"
}


function boundedIdentityText(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined
  const text = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max)
  return text || undefined
}

function boundedIdentityList(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((item): item is string => typeof item === "string")
    .map((item) => boundedIdentityText(item, maxLength)).filter((item): item is string => Boolean(item)))].slice(0, maxItems)
}

function safePortfolioHref(value: unknown): string | undefined {
  const raw = boundedIdentityText(value, 512)
  if (!raw) return undefined
  try {
    const url = new URL(raw)
    if (url.protocol !== "https:" || url.username || url.password) return undefined
    return url.toString()
  } catch { return undefined }
}

/** Server write projection for user-editable professional fields. Verification is never accepted here. */
export function sanitizeProfessionalIdentityPayload(value: unknown): Record<string, unknown> | null {
  if (value == null || typeof value !== "object" || Array.isArray(value)) return null
  const raw = value as Record<string, unknown>
  const experience = Array.isArray(raw.experience) ? raw.experience.slice(0, 10).flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return []
    const item = entry as Record<string, unknown>
    const role = boundedIdentityText(item.role, 90)
    if (!role) return []
    return [{ role, organization: boundedIdentityText(item.organization, 90), from: boundedIdentityText(item.from, 24), to: boundedIdentityText(item.to, 24), summary: boundedIdentityText(item.summary, 360) }]
  }) : []
  const portfolio = Array.isArray(raw.portfolio) ? raw.portfolio.slice(0, 10).flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return []
    const item = entry as Record<string, unknown>
    const title = boundedIdentityText(item.title, 90)
    if (!title) return []
    return [{ title, description: boundedIdentityText(item.description, 360), url: safePortfolioHref(item.url), mediaUrl: safePortfolioHref(item.mediaUrl) }]
  }) : []
  const prefs = raw.contactPreferences && typeof raw.contactPreferences === "object" && !Array.isArray(raw.contactPreferences) ? raw.contactPreferences as Record<string, unknown> : {}
  return {
    title: boundedIdentityText(raw.title, 100), about: boundedIdentityText(raw.about, 800),
    skills: boundedIdentityList(raw.skills, 40, 48), education: boundedIdentityList(raw.education, 20, 120),
    experience, services: boundedIdentityList(raw.services, 20, 100), portfolio,
    locationLabel: boundedIdentityText(raw.locationLabel, 100),
    professionalInterests: boundedIdentityList(raw.professionalInterests, 20, 64),
    communities: boundedIdentityList(raw.communities, 30, 100),
    contactPreferences: { allowInAppMessage: prefs.allowInAppMessage === true, showProfessionOnSocial: prefs.showProfessionOnSocial !== false },
  }
}

/** Server write projection for user-editable business fields. Verification is never accepted here. */
export function sanitizeBusinessIdentityPayload(value: unknown): Record<string, unknown> | null {
  if (value == null || typeof value !== "object" || Array.isArray(value)) return null
  const raw = value as Record<string, unknown>
  return {
    businessName: boundedIdentityText(raw.businessName, 100), category: boundedIdentityText(raw.category, 80),
    about: boundedIdentityText(raw.about, 800), services: boundedIdentityList(raw.services, 20, 100),
    locationLabel: boundedIdentityText(raw.locationLabel, 100), hours: boundedIdentityText(raw.hours, 100),
  }
}
