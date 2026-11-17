/**
 * Central policy metadata — update when material product or data-practice changes ship.
 * Operator/legal review is required before treating a new effective date as published.
 */

export const POLICY_META = {
  productName: "GreenHaven",
  productAlsoKnownAs: "GreenHaven Connect / GH-CONNECT",
  /** Publication date for the rewritten policy set (ISO date). */
  privacyEffectiveDate: "2026-10-27",
  privacyLastUpdated: "2026-10-27",
  termsEffectiveDate: "2026-10-27",
  termsLastUpdated: "2026-10-27",
  supportLastUpdated: "2026-10-27",
  /**
   * Contact channels mirrored from lib/ghc-data SUPPORT_CONTACTS.
   * Do not invent additional channels here.
   */
  contacts: {
    email: "support@ghconnect.com",
    whatsapp: "+2348143225421",
    facebook: "https://www.facebook.com/GreenHavenXpres",
  },
  /**
   * Jurisdiction note — operator should confirm governing law with counsel.
   * Placeholder kept explicit until counsel confirms.
   */
  governingLawNote:
    "Governing law and dispute venue are subject to confirmation by GreenHaven’s operator and qualified counsel. Until confirmed, these documents are governed by the laws applicable where the operator lawfully provides the service, without prejudice to mandatory consumer protections in your country of residence.",
} as const

export type LegalSection = {
  id: string
  title: string
  paragraphs: string[]
}

export const POLICY_REVIEW_TRIGGERS = [
  "New or expanded data collection or identity fields",
  "Pi SDK scope, authentication, payment, or profile access changes",
  "Wallet, GHC ledger, rewards, curation, or monetization behaviour changes",
  "New messaging, social, marketplace, creator, education, transport, or donation features",
  "Media storage provider, region, retention, or access-control changes",
  "Analytics, cookies, advertising, or third-party SDK additions",
  "Account deletion, retention, or privacy-rights procedure changes",
] as const
