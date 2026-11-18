/**
 * Multilingual-ready UI labels (English default).
 * Structure supports later locale packs without redesigning screens.
 */

export type LocaleCode = "en" | "fr" | "es" | "pt" | "ar" | "hi" | "zh" | "sw"

const EN = {
  nav: {
    feed: "Feed",
    find: "Find",
    matches: "Matches",
    communities: "Communities",
    messages: "Messages",
    profile: "Profile",
  },
  relationship: {
    follow: "Follow",
    following: "Following",
    connect: "Connect",
    connected: "Connected",
    match: "Match",
    matched: "Matched",
    message: "Message",
    legend:
      "Follow public activity · Connect mutual friendship · Match intentional interest",
  },
  trust: {
    verification: "Verification",
    reputation: "Reputation",
    vip: "VIP",
    vvip: "VVIP",
    notWallet: "Wallet balances stay private. Verification is not VIP.",
    buildTrust: "Build trust with verification and quality activity",
  },
  ghc: {
    utility: "GHC is an in-app utility — not Pi and not an investment.",
    socialFuel: "Earn GHC for approved helpful activity — never for spam likes.",
    private: "Balances are private by default.",
  },
  find: {
    people: "People",
    professionals: "Professionals",
    communities: "Communities",
    commonGround: "Common ground",
    continent: "Region",
  },
  community: {
    board: "Board",
    chat: "Chat",
    boardNotChat: "Board holds culture and content. Chat is realtime only.",
  },
} as const

export type LabelTree = typeof EN

/** Active locale — client can override later via settings. */
let activeLocale: LocaleCode = "en"

export function setUiLocale(code: LocaleCode) {
  activeLocale = code
}

export function getUiLocale(): LocaleCode {
  return activeLocale
}

/** Resolve labels; non-English falls back to EN until packs are added. */
export function t(): LabelTree {
  return EN
}

export const labels = EN
