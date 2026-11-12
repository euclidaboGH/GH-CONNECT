/**
 * Phase 3–5 reviewed-scope preview translation packs.
 * These packs cover the persistent navigation and essential language-status
 * messages only. They are deliberately marked partial until native reviewers
 * approve terminology and feature-specific screens are translated.
 */
export type ShellMessageKey =
  | "home" | "messages" | "communities" | "cart" | "profile"
  | "mainNavigation" | "mainContent" | "sectionLoaded" | "currentTab" | "goTo" | "save" | "cancel" | "loading" | "retry" | "skipToContent"
  | "language" | "languagePartial" | "contentUnchanged"

export type ShellLocale = "en" | "ha" | "ig" | "yo" | "pcm"

type ShellPack = Record<ShellMessageKey, string>

const EN: ShellPack = {
  home: "Home", messages: "Messages", communities: "Communities", cart: "Cart", profile: "Profile",
  mainNavigation: "Main navigation", mainContent: "GreenHaven main content", sectionLoaded: "section loaded", currentTab: "current tab", goTo: "Go to", save: "Save", cancel: "Cancel", loading: "Loading…", retry: "Try again", skipToContent: "Skip to main content",
  language: "Language", languagePartial: "Navigation, selected product screens, feed and discovery controls, and home greetings have preview translations. Some screens and feature details are still in English.",
  contentUnchanged: "Messages and content written by people stay in the language they were written in.",
}

const PACKS: Record<Exclude<ShellLocale, "en">, ShellPack> = {
  ha: {
    home: "Gida", messages: "Saƙonni", communities: "Al'ummomi", cart: "Kwando", profile: "Bayanan martaba",
    mainNavigation: "Babban kewayawa", mainContent: "Babban abun cikin GreenHaven", sectionLoaded: "an buɗe sashe", currentTab: "shafin da ake ciki", goTo: "Je zuwa", save: "Ajiye", cancel: "Soke", loading: "Ana lodawa…", retry: "Sake gwadawa", skipToContent: "Tsallaka zuwa babban abun ciki",
    language: "Harshe", languagePartial: "An fassara hanyoyin kewayawa, wasu sassan manhaja, sarrafa ciyarwa da bincike, da gaisuwar shafin gida a matsayin gwaji. Wasu shafuka da bayanan fasali suna nan cikin Turanci.",
    contentUnchanged: "Saƙonni da abubuwan da mutane suka rubuta za su ci gaba da kasancewa a harshen da aka rubuta su.",
  },
  ig: {
    home: "Ụlọ", messages: "Ozi", communities: "Obodo", cart: "Akpa ịzụ ahịa", profile: "Profaịlụ",
    mainNavigation: "Nnyagharị bụ isi", mainContent: "Isi ọdịnaya GreenHaven", sectionLoaded: "emepeela ngalaba", currentTab: "taabụ dị ugbu a", goTo: "Gaa na", save: "Chekwaa", cancel: "Kagbuo", loading: "Na-ebu…", retry: "Nwaa ọzọ", skipToContent: "Gaa ozugbo na isi ọdịnaya",
    language: "Asụsụ", languagePartial: "Nnyagharị, ụfọdụ akụkụ ngwa, njikwa ndepụta na nchọpụta, na ekele ụlọ nwere ntụgharị nnwale. Ụfọdụ ibe na nkọwa atụmatụ ka dị n'asụsụ Bekee.",
    contentUnchanged: "Ozi na ihe ndị mmadụ dere ga-adị n'asụsụ e ji dee ha.",
  },
  yo: {
    home: "Ilé", messages: "Àwọn ìránṣẹ́", communities: "Àwọn àwùjọ", cart: "Agbọn", profile: "Profaili",
    mainNavigation: "Ìtọ́sọ́nà pàtàkì", mainContent: "Àkóónú pàtàkì GreenHaven", sectionLoaded: "apá ti ṣí", currentTab: "taabu lọwọlọwọ", goTo: "Lọ sí", save: "Fi pamọ́", cancel: "Fagilé", loading: "Ó ń ṣí…", retry: "Gbìyànjú lẹ́ẹ̀kan síi", skipToContent: "Fo sí àkóónú pàtàkì",
    language: "Èdè", languagePartial: "Àwọn ọ̀nà ìtọ́sọ́nà, àwọn apá kan, ìṣàkóso ìròyìn àti ìwádìí, àti ìkíni ojúlé ní ìtumọ̀ àdánwò. Àwọn ojú-ìwé àti àlàyé míì ṣì wà ní Gẹ̀ẹ́sì.",
    contentUnchanged: "Àwọn ìránṣẹ́ àti àkóónú tí ènìyàn kọ yóò dúró ní èdè tí wọ́n fi kọ́ ọ.",
  },
  pcm: {
    home: "Home", messages: "Messages", communities: "Communities", cart: "Cart", profile: "Profile",
    mainNavigation: "Main navigation", mainContent: "GreenHaven main content", sectionLoaded: "section don load", currentTab: "current tab", goTo: "Go to", save: "Save am", cancel: "Cancel", loading: "E dey load…", retry: "Try again", skipToContent: "Skip go main content",
    language: "Language", languagePartial: "Main navigation, selected screens, feed and discovery controls, and home greetings get preview translation. Some screens and feature details still dey English.",
    contentUnchanged: "Messages and wetin people write go remain for the language wey dem use write am.",
  },
}

export function normalizeShellLocale(locale: string): ShellLocale {
  const language = String(locale || "en").trim().toLowerCase().split(/[-_]/)[0]
  return language === "ha" || language === "ig" || language === "yo" || language === "pcm" ? language : "en"
}

export function getShellMessage(key: ShellMessageKey, locale = "en-US"): string {
  const language = normalizeShellLocale(locale)
  return language === "en" ? EN[key] : PACKS[language][key]
}

export function getShellTranslationStatus(locale = "en-US"): "complete" | "partial" | "none" {
  const rawLanguage = String(locale || "en").trim().toLowerCase().split(/[-_]/)[0]
  if (rawLanguage === "en") return "complete"
  return rawLanguage === "ha" || rawLanguage === "ig" || rawLanguage === "yo" || rawLanguage === "pcm" ? "partial" : "none"
}

export function getShellPack(locale = "en-US"): ShellPack {
  const language = normalizeShellLocale(locale)
  return language === "en" ? EN : PACKS[language]
}
