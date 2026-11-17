import { POLICY_META, type LegalSection } from "./policy-meta"

export const TERMS_INTRO = `These Terms of Service (“Terms”) govern your access to and use of ${POLICY_META.productName} (“GreenHaven”). By accessing or using GreenHaven, you agree to these Terms and to our Privacy Policy. If you do not agree, do not use the service.`

export const TERMS_SECTIONS: LegalSection[] = [
  {
    id: "eligibility",
    title: "1. Eligibility and accounts",
    paragraphs: [
      "You must be old enough to use Pi Network–authenticated applications under applicable law and Pi Network rules (including a minimum age of 18 where required). You must have capacity to enter a binding agreement.",
      "You access GreenHaven primarily through Pi Authentication. You are responsible for activity under your authorized session and for maintaining control of your Pi account and device.",
      "You agree to provide accurate profile information and to update it when it changes. Impersonation, fake identity for fraud, or evasion of enforcement is prohibited.",
    ],
  },
  {
    id: "service",
    title: "2. The service",
    paragraphs: [
      "GreenHaven provides social, community, messaging, discovery, marketplace, membership, rewards, and related utility features that may change over time. Features may differ between Testnet and Mainnet deployments and may be enabled or disabled by configuration.",
      "GreenHaven is not an official Pi Network core product and is not endorsed by Pi Network merely because it uses Pi Authentication or Pi payments.",
      "We may modify, suspend, or discontinue features with reasonable notice where practicable. We are not obligated to keep any particular feature indefinitely.",
    ],
  },
  {
    id: "acceptable-use",
    title: "3. Acceptable use",
    paragraphs: [
      "You agree not to: harass, threaten, or exploit others; post unlawful, hateful, or non-consensual intimate content; spam or manipulate rankings, rewards, referrals, or curation; scrape or attack the service; probe vulnerabilities without authorization; interfere with other users’ enjoyment; or violate applicable law.",
      "Marketplace listings must be accurate and lawful. You are responsible for the goods or services you offer and for complying with consumer and advertising rules that apply to you.",
      "Do not attempt to bypass fees, payment verification, rate limits, or access controls.",
    ],
  },
  {
    id: "content",
    title: "4. User content and licence",
    paragraphs: [
      "You retain ownership of content you create. You grant GreenHaven a worldwide, non-exclusive, royalty-free licence to host, store, reproduce, modify (for formatting or moderation), display, and distribute your content solely to operate and promote the service.",
      "You represent that you have the rights needed to post your content and that it does not infringe others’ rights.",
      "We may remove or restrict content that violates these Terms or creates risk to users or the platform. Copyright complaints may be submitted through Support; we will respond in accordance with applicable law.",
    ],
  },
  {
    id: "ghc-economy",
    title: "5. GHC, rewards, and internal ledger",
    paragraphs: [
      "GreenHaven Coin (GHC) is an internal utility unit on GreenHaven’s ledger. It may be earned (for example daily claims or referrals) or spent on enabled in-app features according to product rules.",
      "GHC is not Pi, not fiat currency, and not a guarantee of external market value. Withdrawal, conversion, or payout features exist only if explicitly enabled and only under their stated eligibility, holds, fees, and limits. Testnet balances and experimental flags may reset or differ from production.",
      "We may reverse, withhold, or adjust ledger entries in cases of error, fraud, abuse, chargeback-equivalent payment failure, or terms violations. Reward programs may change or end.",
    ],
  },
  {
    id: "pi-payments",
    title: "6. Pi payments and purchases",
    paragraphs: [
      "Certain features may require Pi payments processed through Pi’s payment infrastructure and verified by GreenHaven payment intents. You authorize applicable charges when you approve a payment in the Pi flow.",
      "Payment finality, failures, and any refunds depend on Pi Network mechanisms, our verification results, and these Terms. Completing a client UI step without server verification does not guarantee fulfilment.",
      "Membership, listing fees, community fees, and marketplace checkout follow the prices and rails shown at the time of purchase. Taxes, if any, are your responsibility unless required otherwise by law.",
    ],
  },
  {
    id: "marketplace",
    title: "7. Marketplace and communities",
    paragraphs: [
      "Marketplace transactions may occur between users. GreenHaven provides software tools and optional fee collection; unless expressly stated, GreenHaven is not the seller of user-listed goods and does not guarantee delivery, quality, or offline performance.",
      "Community spaces must follow acceptable-use rules. Moderators and operators may enforce community standards consistent with these Terms.",
    ],
  },
  {
    id: "enforcement",
    title: "8. Suspension and termination",
    paragraphs: [
      "We may suspend or terminate access for violations of these Terms, legal requirements, or risks to the platform or other users. Where reasonable, we may provide notice; severe abuse may result in immediate action.",
      "You may stop using GreenHaven at any time. Provisions that by nature should survive (including intellectual property, disclaimers, limitations, and indemnity) survive termination.",
    ],
  },
  {
    id: "disclaimers",
    title: "9. Disclaimers",
    paragraphs: [
      "GREENHAVEN IS PROVIDED “AS IS” AND “AS AVAILABLE.” TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE DISCLAIM WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.",
      "We do not warrant uninterrupted operation, error-free operation, or that content from other users is accurate or safe. Third-party services (including Pi Network and hosting providers) are outside our full control.",
    ],
  },
  {
    id: "liability",
    title: "10. Limitation of liability",
    paragraphs: [
      "To the maximum extent permitted by law, GreenHaven and its operators will not be liable for indirect, incidental, special, consequential, or punitive damages, or for loss of profits, data, or goodwill.",
      "To the extent liability cannot be excluded, our aggregate liability arising out of these Terms or the service is limited to the greater of (a) the amounts you paid to GreenHaven for the specific paid feature giving rise to the claim during the three months before the claim, or (b) fifty US dollars (or local currency equivalent), except where prohibited by mandatory law.",
      "Some jurisdictions do not allow certain limitations; in those jurisdictions, our liability is limited to the fullest extent permitted.",
    ],
  },
  {
    id: "indemnity",
    title: "11. Indemnity",
    paragraphs: [
      "You agree to indemnify and hold harmless GreenHaven and its operators from claims arising out of your content, your marketplace conduct, your misuse of the service, or your violation of these Terms or third-party rights, to the extent permitted by law.",
    ],
  },
  {
    id: "law",
    title: "12. Governing law and disputes",
    paragraphs: [
      POLICY_META.governingLawNote,
      "Nothing in these Terms limits mandatory consumer rights that cannot be waived by contract in your jurisdiction.",
    ],
  },
  {
    id: "changes",
    title: "13. Changes to the Terms",
    paragraphs: [
      `We may update these Terms. The effective and last-updated dates will be revised when changes are published. Material changes will be communicated through reasonable means (for example in-app notice).`,
      "If you continue to use GreenHaven after changes take effect, you accept the updated Terms where allowed by law.",
    ],
  },
  {
    id: "contact",
    title: "14. Contact",
    paragraphs: [
      `Questions about these Terms: ${POLICY_META.contacts.email}`,
      `WhatsApp: ${POLICY_META.contacts.whatsapp}`,
      "Also see /support for help topics and /privacy for data practices.",
    ],
  },
]

export function termsPlainText(): string {
  const parts = [
    `Terms of Service — ${POLICY_META.productName}`,
    `Effective: ${POLICY_META.termsEffectiveDate}`,
    `Last updated: ${POLICY_META.termsLastUpdated}`,
    "",
    TERMS_INTRO,
    "",
  ]
  for (const s of TERMS_SECTIONS) {
    parts.push(s.title, ...s.paragraphs, "")
  }
  return parts.join("\n")
}
