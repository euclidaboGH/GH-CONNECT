/**
 * Phase 4 product-surface language packs.
 * These are preview translations for high-frequency interface chrome only.
 * Feature-specific legal, financial, identity and user-authored content stays
 * in its authoritative language until independently reviewed.
 */
export type ProductMessageKey =
  | "messagesTitle" | "messagesSubtitle" | "all" | "cart" | "allTopics" | "directMessages" | "unread" | "requests" | "communities"
  | "markAllRead" | "new" | "offlineNotice" | "communityTitle" | "create" | "searchCommunity"
  | "myCommunities" | "discover" | "marketplaceTitle" | "buySellSubtitle" | "browse" | "sell" | "sellerCentre"
  | "orders" | "saved" | "categories" | "searchListings" | "settingsTitle" | "searchSettings" | "profileTitle" | "rewardsTitle" | "dashboard" | "about" | "media" | "posts" | "yourCommunities" | "accountSetup" | "wallet" | "missions" | "opportunities" | "history" | "achievements"
  | "back" | "clearSearch" | "loading" | "retry" | "save" | "cancel" | "translationNotice"

const EN: Record<ProductMessageKey, string> = {
  messagesTitle: "Messages", messagesSubtitle: "People, requests and community conversations in one place",
  all: "All", cart: "Cart", allTopics: "All topics", directMessages: "DMs", unread: "Unread", requests: "Requests", communities: "Communities",
  markAllRead: "Mark all read", new: "new", offlineNotice: "Offline — existing conversations remain available where cached. Reconnect before sending new messages or attachments.",
  communityTitle: "Communities", create: "Create", searchCommunity: "Search name, city, topic…", myCommunities: "My communities", discover: "Discover",
  marketplaceTitle: "Marketplace", buySellSubtitle: "Buy & sell with π or GHC", browse: "Browse", sell: "Sell", sellerCentre: "Seller Centre", orders: "Orders", saved: "Saved", categories: "Categories", searchListings: "Search listings…",
  settingsTitle: "Settings", searchSettings: "Search wallet, privacy, messages, language…", profileTitle: "Profile", rewardsTitle: "Rewards", dashboard: "Dashboard", about: "About", media: "Media", posts: "Posts", yourCommunities: "Your communities", accountSetup: "Account setup", wallet: "Wallet", missions: "Missions", opportunities: "Opportunities", history: "History", achievements: "Achievements", back: "Back", clearSearch: "Clear search", loading: "Loading…", retry: "Try again", save: "Save", cancel: "Cancel",
  translationNotice: "This part of GreenHaven has a preview translation. Some details may still appear in English.",
}

const PACKS: Record<"ha" | "ig" | "yo" | "pcm", Partial<Record<ProductMessageKey, string>>> = {
  ha: {
    messagesTitle: "Saƙonni", messagesSubtitle: "Mutane, buƙatu da tattaunawar al'umma a wuri guda", all: "Duka", cart: "Kwando", allTopics: "Dukkan batutuwa", directMessages: "Saƙonni kai tsaye", unread: "Ba a karanta ba", requests: "Buƙatu", communities: "Al'ummomi", markAllRead: "Alama duka an karanta", new: "sabo", offlineNotice: "Babu intanet — tattaunawar da aka adana za ta kasance. Haɗa intanet kafin aika saƙonni ko fayiloli.",
    communityTitle: "Al'ummomi", create: "Ƙirƙira", searchCommunity: "Nemo suna, gari ko batu…", myCommunities: "Al'ummomina", discover: "Gano",
    marketplaceTitle: "Kasuwar GreenHaven", buySellSubtitle: "Saya da sayarwa da π ko GHC", browse: "Duba kaya", sell: "Sayar", sellerCentre: "Cibiyar mai sayarwa", orders: "Oda", saved: "Ajiyayyu", categories: "Rukuni-rukuni", searchListings: "Nemo kaya…",
    settingsTitle: "Saituna", searchSettings: "Nemo wallet, sirri, saƙonni, harshe…", profileTitle: "Bayanan martaba", rewardsTitle: "Lada", dashboard: "Allon kulawa", about: "Game da", media: "Kafafen yaɗa labarai", posts: "Rubuce-rubuce", yourCommunities: "Al’ummomina", accountSetup: "Saita asusu", wallet: "Wallet", missions: "Ayyuka", opportunities: "Damar samun lada", history: "Tarihi", achievements: "Nasara", back: "Koma baya", clearSearch: "Share bincike", loading: "Ana lodawa…", retry: "Sake gwadawa", save: "Ajiye", cancel: "Soke",
    translationNotice: "Wannan ɓangaren GreenHaven yana da fassarar gwaji. Wasu bayanai na iya kasancewa cikin Turanci.",
  },
  ig: {
    messagesTitle: "Ozi", messagesSubtitle: "Ndị mmadụ, arịrịọ na mkparịta ụka obodo n'otu ebe", all: "Ha niile", cart: "Akpa ịzụ ahịa", allTopics: "Isiokwu niile", directMessages: "Ozi onwe onye", unread: "Agụghị", requests: "Arịrịọ", communities: "Obodo", markAllRead: "Kaa ha niile dị ka agụla", new: "ọhụrụ", offlineNotice: "Ịntanetị adịghị — mkparịta ụka echekwara ka dị. Jikọọ tupu izipu ozi ma ọ bụ faịlụ.",
    communityTitle: "Obodo", create: "Mepụta", searchCommunity: "Chọọ aha, obodo ma ọ bụ isiokwu…", myCommunities: "Obodo m", discover: "Chọpụta",
    marketplaceTitle: "Ahịa GreenHaven", buySellSubtitle: "Zụta ma ree site na π ma ọ bụ GHC", browse: "Chọgharịa", sell: "Ree", sellerCentre: "Ebe onye na-ere ahịa", orders: "Iwu ịzụ ahịa", saved: "Echekwara", categories: "Ụdị ngwaahịa", searchListings: "Chọọ ngwaahịa…",
    settingsTitle: "Ntọala", searchSettings: "Chọọ wallet, nzuzo, ozi, asụsụ…", profileTitle: "Profaịlụ", rewardsTitle: "Ụgwọ ọrụ", dashboard: "Dashboard", about: "Maka", media: "Mgbasa ozi", posts: "Ihe e bipụtara", yourCommunities: "Obodo m", accountSetup: "Ntọala akaụntụ", wallet: "Wallet", missions: "Ọrụ", opportunities: "Ohere", history: "Akụkọ", achievements: "Mmezu", back: "Laghachi", clearSearch: "Hichapụ ọchụchọ", loading: "Na-ebu…", retry: "Nwaa ọzọ", save: "Chekwaa", cancel: "Kagbuo",
    translationNotice: "Akụkụ GreenHaven a nwere ntụgharị nnwale. Ụfọdụ nkọwa ka nwere ike ịdị n'asụsụ Bekee.",
  },
  yo: {
    messagesTitle: "Àwọn ìránṣẹ́", messagesSubtitle: "Àwọn ènìyàn, ìbéèrè àti ìjíròrò àwùjọ ní ibi kan", all: "Gbogbo rẹ̀", cart: "Agbọn", allTopics: "Gbogbo kókó", directMessages: "Ìránṣẹ́ tààrà", unread: "Àìka", requests: "Àwọn ìbéèrè", communities: "Àwọn àwùjọ", markAllRead: "Fi àmì sí gbogbo rẹ̀ pé a ti kà á", new: "tuntun", offlineNotice: "Kò sí ìsopọ̀ — àwọn ìjíròrò tí a ti fipamọ́ ṣì wà. Sopọ̀ mọ́ ẹ̀rọ ayélujára kí o tó fi ìránṣẹ́ tàbí fáìlì ránṣẹ́.",
    communityTitle: "Àwọn àwùjọ", create: "Ṣẹ̀dá", searchCommunity: "Wá orúkọ, ìlú tàbí kókó…", myCommunities: "Àwọn àwùjọ mi", discover: "Ṣàwárí",
    marketplaceTitle: "Ọjà GreenHaven", buySellSubtitle: "Ra àti tà pẹ̀lú π tàbí GHC", browse: "Wo ọjà", sell: "Ta", sellerCentre: "Ibùdó olùtajà", orders: "Àwọn àṣẹ", saved: "Tí a fipamọ́", categories: "Àwọn ẹ̀ka", searchListings: "Wá ọjà…",
    settingsTitle: "Ètò", searchSettings: "Wá wallet, àṣírí, ìránṣẹ́, èdè…", profileTitle: "Profaili", rewardsTitle: "Ẹ̀bùn", dashboard: "Dashboard", about: "Nípa", media: "Àwọn fọ́tò àti fídíò", posts: "Àwọn ìtẹ̀jáde", yourCommunities: "Àwọn àwùjọ mi", accountSetup: "Ètò àkọọ́lẹ̀", wallet: "Wallet", missions: "Àwọn iṣẹ́", opportunities: "Àǹfààní", history: "Ìtàn", achievements: "Àwọn àṣeyọrí", back: "Padà", clearSearch: "Pa ìwádìí rẹ́", loading: "Ó ń ṣí…", retry: "Gbìyànjú lẹ́ẹ̀kan síi", save: "Fi pamọ́", cancel: "Fagilé",
    translationNotice: "Apá GreenHaven yìí ní ìtumọ̀ àdánwò. Àwọn àlàyé kan ṣì lè hàn ní Gẹ̀ẹ́sì.",
  },
  pcm: {
    messagesTitle: "Messages", messagesSubtitle: "People, requests and community chats for one place", all: "All", cart: "Cart", allTopics: "All topics", directMessages: "DMs", unread: "Unread", requests: "Requests", communities: "Communities", markAllRead: "Mark all as read", new: "new", offlineNotice: "Network no dey — chats wey don cache still dey. Connect before you send messages or attachments.",
    communityTitle: "Communities", create: "Create", searchCommunity: "Search name, city or topic…", myCommunities: "My communities", discover: "Discover",
    marketplaceTitle: "Marketplace", buySellSubtitle: "Buy and sell with π or GHC", browse: "Browse", sell: "Sell", sellerCentre: "Seller Centre", orders: "Orders", saved: "Saved", categories: "Categories", searchListings: "Search listings…",
    settingsTitle: "Settings", searchSettings: "Search wallet, privacy, messages, language…", profileTitle: "Profile", rewardsTitle: "Rewards", dashboard: "Dashboard", about: "About", media: "Media", posts: "Posts", yourCommunities: "Your communities", accountSetup: "Account setup", wallet: "Wallet", missions: "Missions", opportunities: "Opportunities", history: "History", achievements: "Achievements", back: "Back", clearSearch: "Clear search", loading: "E dey load…", retry: "Try again", save: "Save am", cancel: "Cancel",
    translationNotice: "This GreenHaven section get preview translation. Some details fit still show for English.",
  },
}

export function getProductMessage(key: ProductMessageKey, locale = "en-US"): string {
  const language = String(locale || "en").trim().toLowerCase().split(/[-_]/)[0]
  if (language === "ha" || language === "ig" || language === "yo" || language === "pcm") return PACKS[language][key] ?? EN[key]
  return EN[key]
}

export function getProductTranslationStatus(locale = "en-US"): "complete" | "partial" | "none" {
  const language = String(locale || "en").trim().toLowerCase().split(/[-_]/)[0]
  if (language === "en") return "complete"
  return language === "ha" || language === "ig" || language === "yo" || language === "pcm" ? "partial" : "none"
}
