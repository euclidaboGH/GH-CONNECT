import { POLICY_META, type LegalSection } from "./policy-meta"

export const PRIVACY_INTRO = `This Privacy Policy explains how ${POLICY_META.productName} (“GreenHaven”, “we”, “us”) handles information when you use the GreenHaven application, related websites, and services that integrate with the Pi Network platform. GreenHaven is an independent application. It is not an official product of the Pi Network core team unless expressly stated by Pi Network in official channels.`

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    id: "who-we-are",
    title: "1. Who we are and scope",
    paragraphs: [
      "GreenHaven is a social and utility platform for Pioneers. Features may include profiles, feeds, messaging, communities, discovery/matching, notifications, a marketplace, membership offerings, rewards, and an internal GreenHaven Coin (GHC) ledger used inside the app.",
      "This policy applies to information processed when you use GreenHaven through Pi Browser or other supported clients. It does not govern Pi Network’s own apps, wallets, or blockchain, which are controlled by their respective operators under their own terms and privacy notices.",
    ],
  },
  {
    id: "information-we-collect",
    title: "2. Information we collect",
    paragraphs: [
      "We aim to collect only what is needed to operate GreenHaven. Categories include:",
      "Account and identity. When you sign in with Pi Authentication, our servers verify your session with the Pi Platform and store an application-linked Pi user identifier and, when provided by Pi, a display username. We also create or maintain a GreenHaven account identifier used inside the product.",
      "Profile information you provide. Display name, bio, interests, location text or region you choose to share, profile and cover images, and similar profile fields you edit in the app.",
      "User-generated content. Posts, comments, reactions, stories, messages, community contributions, marketplace listings and related media you upload or send.",
      "Usage and engagement records. Interactions such as follows, connection requests, saves, votes/curation actions, notification receipts, and feature usage needed to power feeds, rankings, and abuse prevention.",
      "Device and session data. Session tokens, device-lock / local session-lock preferences, approximate client environment signals needed for security and reliability, and technical logs (for example error diagnostics).",
      "Payment-related records. For Pi payments you initiate in the app, we store payment intent identifiers, status, amounts, and verification outcomes needed to fulfil membership, marketplace, fees, or other in-app purchases. GreenHaven does not take custody of your Pi wallet passphrase or private keys.",
      "Internal economy records. GHC balances, ledger entries, reward claims, referral settlements, fee settlements, and related audit events maintained by GreenHaven’s servers for in-app utility accounting.",
    ],
  },
  {
    id: "pi-network",
    title: "3. Pi Network authentication and payments",
    paragraphs: [
      "Sign-in uses Pi Authentication via the Pi SDK. We do not offer a separate email/password registration as a primary login path for the Pi-integrated product.",
      "After you authorize GreenHaven, servers validate your identity with Pi’s platform APIs according to the scopes and capabilities Pi makes available to the app. We store the resulting application user linkage; we do not receive or store your Pi wallet passphrase.",
      "When you approve a Pi payment in the app, payment completion is verified through Pi’s payment flows and our server-side payment-intent records. Statuses and identifiers are retained for fulfilment, dispute investigation, fraud prevention, and accounting. Refunds and reversals, if any, follow the rules of the payment rail and our Terms of Service.",
      "GreenHaven may show a “Pi-connected” or similar badge only after server-side verification succeeds. That badge reflects app verification state, not a legal identity document and not an endorsement by Pi Network.",
    ],
  },
  {
    id: "ghc",
    title: "4. GreenHaven Coin (GHC)",
    paragraphs: [
      "GHC is an internal utility unit recorded on GreenHaven’s ledger. It is used for in-app rewards, fees, and features as implemented in the product configuration.",
      "GHC is not Pi, is not legal tender, and is not described by GreenHaven as a listed cryptocurrency or as a guaranteed withdrawable cash balance. Availability of any conversion, payout, or external transfer feature depends on product configuration, eligibility rules, and applicable law. Features may be limited on Testnet or disabled for compliance reasons.",
      "Ledger entries, pending/available/locked states, and claim events are stored to operate the economy honestly and to prevent double-spend or abuse.",
    ],
  },
  {
    id: "media-storage",
    title: "5. Media and storage",
    paragraphs: [
      "Images, video, audio, and documents you upload may be stored in private object storage (including Supabase Storage and, where configured, other durable storage such as Cloudflare R2). Access is mediated by application authorization and time-limited or signed URLs rather than unrestricted public bucket listing.",
      "Media associated with messages, profiles, posts, communities, or listings is processed to deliver the feature you used (display, moderation, abuse review). Do not upload content you are not entitled to share.",
    ],
  },
  {
    id: "how-we-use",
    title: "6. How we use information",
    paragraphs: [
      "We use information to: provide and improve GreenHaven features; authenticate you and protect accounts; personalize feeds and discovery within product rules; process Pi payments and internal GHC accounting; send in-app notifications you enable; prevent fraud, spam, and abuse; comply with law; and communicate about the service.",
      "We do not sell your personal information as a standalone commercial product. Service providers that host or process data on our behalf may process data only to provide those services under contractual and technical controls appropriate to their role.",
    ],
  },
  {
    id: "sharing",
    title: "7. Sharing and third parties",
    paragraphs: [
      "Other users may see information you choose to make public or share through social features (for example profile fields, posts, and listings), subject to privacy settings where implemented.",
      "Infrastructure providers. Hosting (for example Vercel), database and auth infrastructure (Supabase), media storage providers, and Pi Network platform services process data as needed to run authentication, APIs, storage, and payments.",
      "Legal and safety. We may disclose information when required by law, to protect rights and safety, or to investigate abuse, fraud, or security incidents.",
      "We do not control Pi Network’s independent processing of your Pioneer account outside GreenHaven.",
    ],
  },
  {
    id: "international",
    title: "8. International processing",
    paragraphs: [
      "GreenHaven may be hosted and accessed internationally. Your information may be processed in countries where our service providers operate. Where required, we use appropriate safeguards for cross-border processing. Exact data-centre regions depend on deployment configuration.",
    ],
  },
  {
    id: "retention",
    title: "9. Retention, correction, and deletion",
    paragraphs: [
      "We retain account, content, ledger, and security records for as long as needed to provide the service, meet legal obligations, resolve disputes, and enforce agreements. Retention periods vary by record type (for example payment audit trails may be kept longer than ephemeral UI state).",
      "You may update many profile fields in the app. For access, correction, or deletion requests beyond in-app controls, contact support using the channels listed in this policy. We may need to verify the request is from the account holder. Some records cannot be fully erased immediately where law, fraud prevention, or ledger integrity requires retention.",
      "Deleting the app from a device does not by itself delete server-side account data. Follow in-app or support deletion procedures where available.",
    ],
  },
  {
    id: "security",
    title: "10. Security",
    paragraphs: [
      "We use technical and organizational measures appropriate to a production web application, including server-side authorization, session handling, database access controls (including row-level security where configured), and private media access patterns.",
      "No method of transmission or storage is completely secure. You should protect your Pi account, device lock, and session. Never share passphrases, seed phrases, or authentication tokens with anyone, including people claiming to be support.",
    ],
  },
  {
    id: "cookies",
    title: "11. Cookies, local storage, and similar technologies",
    paragraphs: [
      "GreenHaven uses cookies, local storage, and similar technologies as needed for authentication sessions, preferences, offline queues, and basic product operation. We do not operate a separate advertising tracking network inside the app as a core feature. If analytics or diagnostic tooling is enabled in a deployment, it is limited to operating and improving the service.",
    ],
  },
  {
    id: "children",
    title: "12. Children and age",
    paragraphs: [
      "GreenHaven is intended for adults. You must meet the minimum age required by applicable law and by Pi Network’s rules for using Pi-authenticated apps (including being at least 18 where required). We do not knowingly collect personal information from children under those thresholds. If you believe a minor has created an account, contact support so we can take appropriate action.",
    ],
  },
  {
    id: "rights",
    title: "13. Your privacy rights",
    paragraphs: [
      "Depending on your location, you may have rights to request access, correction, deletion, restriction, or information about how your data is processed. Nigerian users may have rights under the Nigeria Data Protection Act and related regulations. Users in other jurisdictions may have rights under local law (for example access and erasure rights where those laws apply).",
      "To exercise rights, use in-app controls where available or contact us at the privacy/support channels below. We may ask for information to verify your request. Mandatory legal exemptions (for example ongoing fraud investigation) may limit some requests.",
    ],
  },
  {
    id: "changes",
    title: "14. Changes to this policy",
    paragraphs: [
      `We may update this Privacy Policy as GreenHaven evolves. The “Last updated” date at the top will change when we publish revisions. Material changes will be highlighted in-product or by other reasonable notice where required.`,
      "Continued use after the effective date of an update constitutes acceptance of the revised policy where permitted by law. If consent is required for a specific change, we will request it through an appropriate mechanism.",
    ],
  },
  {
    id: "contact",
    title: "15. Contact",
    paragraphs: [
      `Privacy and support requests: ${POLICY_META.contacts.email}`,
      `WhatsApp: ${POLICY_META.contacts.whatsapp}`,
      `Facebook: ${POLICY_META.contacts.facebook}`,
      "Do not send passwords, Pi passphrases, private keys, or full payment credentials through these channels.",
    ],
  },
]

export function privacyPlainText(): string {
  const parts = [
    `Privacy Policy — ${POLICY_META.productName}`,
    `Effective: ${POLICY_META.privacyEffectiveDate}`,
    `Last updated: ${POLICY_META.privacyLastUpdated}`,
    "",
    PRIVACY_INTRO,
    "",
  ]
  for (const s of PRIVACY_SECTIONS) {
    parts.push(s.title, ...s.paragraphs, "")
  }
  return parts.join("\n")
}
