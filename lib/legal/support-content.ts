import { POLICY_META } from "./policy-meta"

export type SupportFaq = {
  id: string
  category: string
  question: string
  answer: string
}

export const SUPPORT_INTRO = `GreenHaven Support helps with account access, Pi sign-in, profiles, messaging, wallet records, rewards, payments, and safety. We cannot recover Pi wallet passphrases. Never share passphrases, private keys, or one-time codes with anyone.`

export const SUPPORT_FAQS: SupportFaq[] = [
  {
    id: "pi-signin",
    category: "Account & Pi sign-in",
    question: "I cannot sign in with Pi",
    answer:
      "Open GreenHaven inside Pi Browser, ensure you are logged into Pi, and approve the authentication prompt. If the session fails, close other Pi app sessions, refresh, and try again. GreenHaven uses Pi Authentication only for the primary login path.",
  },
  {
    id: "session-lock",
    category: "Account & Pi sign-in",
    question: "What is the session / device lock?",
    answer:
      "Session lock is an in-app protection after inactivity or manual lock. Unlock with the method configured on your device session. It does not replace your Pi account security.",
  },
  {
    id: "gh-id",
    category: "Account & Pi sign-in",
    question: "Which ID do I use for referrals?",
    answer:
      "Use the GreenHaven ID shown on your profile after the server identity loads (format such as GH-XXXXXX). Pi username may also be accepted by referral resolution when configured. If the app says the code is invalid, refresh profile identity and try the exact ID displayed—not a guessed value.",
  },
  {
    id: "profile-media",
    category: "Profile & media",
    question: "My photo or video does not appear",
    answer:
      "Uploads must complete to durable storage. Stay online until the upload finishes. Private media is delivered through authorized URLs; a failed network hop can look like a blank image—retry or re-open the screen. Avoid publishing local-only blob previews.",
  },
  {
    id: "messaging",
    category: "Messaging & notifications",
    question: "Messages send twice or stay pending",
    answer:
      "A short send lock prevents double taps. Offline messages queue and flush when connectivity returns. Pull to refresh the conversation if a duplicate appears after recovery.",
  },
  {
    id: "notifications",
    category: "Messaging & notifications",
    question: "I am not receiving notifications",
    answer:
      "Check in-app notification filters and browser/Pi permission prompts. Some categories are social, marketplace, or economy related—open the notification centre filters if available.",
  },
  {
    id: "ghc-balance",
    category: "Wallet, GHC & rewards",
    question: "Why is GHC pending or locked?",
    answer:
      "Some rewards mature after a holding period (for example multi-hour maturity) before moving to available balance. Pending and locked amounts are ledger states, not Pi balances. Pull to refresh the wallet after claiming.",
  },
  {
    id: "daily-claim",
    category: "Wallet, GHC & rewards",
    question: "Daily claim is not showing",
    answer:
      "When a claim is available, a gold GHC claim control can appear over the main content (not as a permanent header bar). You can also open claim from Rewards. Claiming requires a network connection and an authenticated session.",
  },
  {
    id: "pi-payment",
    category: "Payments",
    question: "A Pi payment was approved but the feature did not unlock",
    answer:
      "Fulfilment depends on server verification of the payment intent. Wait briefly, then refresh Wallet, Membership, Marketplace orders, or the feature screen. If status remains incomplete, contact support with the approximate time and feature name—not your passphrase.",
  },
  {
    id: "marketplace",
    category: "Marketplace & communities",
    question: "Listing or community create fee failed",
    answer:
      "Fees follow the rail shown at checkout (often Pi when Pi-only commerce is enabled). Complete the Pi payment when prompted; selecting a rail without completing payment will not create a paid listing or group. Retry only once connectivity is stable.",
  },
  {
    id: "privacy-request",
    category: "Privacy & safety",
    question: "How do I request data access or deletion?",
    answer: `Use in-app profile and settings controls first. For additional privacy requests, email ${POLICY_META.contacts.email} from a channel we can associate with your account and describe the request. Do not send government ID images unless we specifically request them through a secure process.`,
  },
  {
    id: "report-abuse",
    category: "Privacy & safety",
    question: "How do I report abuse or a bug?",
    answer:
      "Use in-app report flows on posts or profiles when available. For security issues or bugs, email support with steps to reproduce, approximate time, and screenshots that do not contain secrets. Never include passphrases or full payment credentials.",
  },
]

export const SUPPORT_CATEGORIES = Array.from(new Set(SUPPORT_FAQS.map((f) => f.category)))
