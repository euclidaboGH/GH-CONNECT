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
  portfolio?: Array<{ title: string; url?: string; description?: string }>
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
