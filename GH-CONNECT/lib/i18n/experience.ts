/**
 * Phase 5 high-frequency experience language packs.
 * Preview UI strings only: never translate user-authored content, identity data,
 * legal copy, wallet balances, payment states, or transaction instructions.
 * Native-speaker review is required before any pack can be marked complete.
 */
export type ExperienceMessageKey =
  | "feed" | "forYou" | "following" | "friends" | "trending" | "saved"
  | "feedFilters" | "personalizeFeed" | "feedPersonalization" | "yourFeedPriorities"
  | "locationRelevance" | "nearby" | "country" | "worldwide" | "whatMattersNow"
  | "balanced" | "connections" | "professional" | "matching" | "focusMode" | "focusModeHelp" | "reset"
  | "searchFeed" | "searchPosts" | "refreshFeed" | "offlineFeed" | "draftsOnDevice"
  | "discover" | "communities" | "clearSearch" | "cancel"
  | "people" | "professionals" | "collaborators" | "mentors" | "events" | "activities" | "services"
  | "searchPeople" | "connectionFilters" | "onlineNow" | "presenceOffline" | "discoveryOutcome"
  | "discoveryIntroTitle" | "intents" | "edit" | "youAreOffline" | "offlineDiscovery"
  | "homeMorning" | "homeAfternoon" | "homeEvening" | "homeNight" | "there"

export type ExperienceLocale = "en" | "ha" | "ig" | "yo" | "pcm"
type ExperiencePack = Record<ExperienceMessageKey, string>

const EN: ExperiencePack = {
  feed: "Feed", forYou: "For You", following: "Following", friends: "Friends", trending: "Trending", saved: "Saved",
  feedFilters: "Feed filters", personalizeFeed: "Personalize feed", feedPersonalization: "Feed personalization", yourFeedPriorities: "Your feed, your priorities",
  locationRelevance: "Location relevance", nearby: "Nearby", country: "Country", worldwide: "Worldwide", whatMattersNow: "What matters now",
  balanced: "Balanced", connections: "Connections", professional: "Professional", matching: "Matching", focusMode: "Focus mode", focusModeHelp: "Reduce lower-value feed items and emphasize stronger relevance.", reset: "Reset",
  searchFeed: "Search feed", searchPosts: "Search posts, people, hashtags…", refreshFeed: "Refresh feed", offlineFeed: "Offline — showing available feed data. New actions may require a connection.", draftsOnDevice: "Drafts on this device",
  discover: "Discover", communities: "Communities", clearSearch: "Clear search", cancel: "Cancel",
  people: "People", professionals: "Professionals", collaborators: "Collaborators", mentors: "Mentors", events: "Events", activities: "Activities", services: "Services",
  searchPeople: "Search people, interests…", connectionFilters: "Connection filters", onlineNow: "Online now", presenceOffline: "Presence offline", discoveryOutcome: "Discovery outcome",
  discoveryIntroTitle: "Discover people and opportunities", intents: "Intents", edit: "Edit", youAreOffline: "You’re offline", offlineDiscovery: "Showing candidates already on this device. New people load when you reconnect.",
  homeMorning: "Good morning", homeAfternoon: "Good afternoon", homeEvening: "Good evening", homeNight: "Good night", there: "there",
}

const PACKS: Record<Exclude<ExperienceLocale, "en">, Partial<ExperiencePack>> = {
  ha: {
    feed: "Ciyarwa", forYou: "Na gare ka", following: "Wadanda kake bi", friends: "Abokai", trending: "Abin da ke tashe", saved: "Ajiyayyu",
    feedFilters: "Matatun ciyarwa", personalizeFeed: "Keɓance ciyarwa", feedPersonalization: "Keɓance ciyarwa", yourFeedPriorities: "Abubuwan da suka fi maka muhimmanci",
    locationRelevance: "Muhimmancin wuri", nearby: "Kusa", country: "Ƙasa", worldwide: "Duniya baki ɗaya", whatMattersNow: "Abin da ya fi muhimmanci yanzu",
    balanced: "Daidaito", connections: "Haɗin kai", professional: "Na sana'a", matching: "Dacewa", focusMode: "Yanayin mayar da hankali", focusModeHelp: "Rage abubuwan da ba su da muhimmanci sosai, ka fi ganin masu dacewa.", reset: "Sake saita",
    searchFeed: "Nemo ciyarwa", searchPosts: "Nemo rubuce-rubuce, mutane, hashtags…", refreshFeed: "Sabunta ciyarwa", offlineFeed: "Babu intanet — ana nuna bayanan ciyarwa da ke akwai. Wasu ayyuka na iya buƙatar haɗin intanet.", draftsOnDevice: "Daftarin da ke wannan na'ura",
    discover: "Gano", communities: "Al’ummomi", clearSearch: "Share bincike", cancel: "Soke",
    people: "Mutane", professionals: "Masu sana'a", collaborators: "Abokan aiki", mentors: "Masu jagoranci", events: "Abubuwan da ke faruwa", activities: "Ayyuka", services: "Ayyuka na hidima",
    searchPeople: "Nemo mutane da abubuwan sha'awa…", connectionFilters: "Matatun haɗin kai", onlineNow: "Suna kan layi yanzu", presenceOffline: "Ba a samun halin kan layi", discoveryOutcome: "Sakamakon bincike",
    discoveryIntroTitle: "Gano mutane da damammaki", intents: "Manufofi", edit: "Gyara", youAreOffline: "Ba ka kan layi", offlineDiscovery: "Ana nuna mutanen da aka riga aka adana a wannan na'ura. Sabbin mutane za su bayyana idan ka dawo kan layi.",
    homeMorning: "Ina kwana", homeAfternoon: "Barka da rana", homeEvening: "Barka da yamma", homeNight: "Barka da dare", there: "aboki",
  },
  ig: {
    feed: "Ndepụta", forYou: "Maka", following: "Ndị ị na-eso", friends: "Ndị enyi", trending: "Ihe na-ewu ewu", saved: "Echekwara",
    feedFilters: "Ihe nzacha ndepụta", personalizeFeed: "Hazie ndepụta gị", feedPersonalization: "Nhazi ndepụta", yourFeedPriorities: "Ihe ndị kacha gị mkpa",
    locationRelevance: "Mkpa ebe", nearby: "Nso", country: "Mba", worldwide: "Ụwa niile", whatMattersNow: "Ihe kacha mkpa ugbu a",
    balanced: "Nha nhata", connections: "Njikọ", professional: "Ọkachamara", matching: "Dakọtara", focusMode: "Ụdị itinye uche", focusModeHelp: "Belata ihe na-abaghị uru ma gosipụta ihe kacha dabara adaba.", reset: "Tọgharịa",
    searchFeed: "Chọọ ndepụta", searchPosts: "Chọọ ihe e bipụtara, ndị mmadụ, hashtags…", refreshFeed: "Melite ndepụta", offlineFeed: "Ịntanetị adịghị — a na-egosi data dị ugbu a. Ụfọdụ omume nwere ike ịchọ njikọ ịntanetị.", draftsOnDevice: "Ihe echekwara dịka draft na ngwaọrụ a",
    discover: "Chọpụta", communities: "Obodo", clearSearch: "Hichapụ ọchụchọ", cancel: "Kagbuo",
    people: "Ndị mmadụ", professionals: "Ndị ọkachamara", collaborators: "Ndị mmekọ", mentors: "Ndị nduzi", events: "Ihe omume", activities: "Ihe a na-eme", services: "Ọrụ enyemaka",
    searchPeople: "Chọọ ndị mmadụ na mmasị…", connectionFilters: "Ihe nzacha njikọ", onlineNow: "Ha nọ n'ịntanetị ugbu a", presenceOffline: "Ọnọdụ ịntanetị adịghị", discoveryOutcome: "Nsonaazụ nchọpụta",
    discoveryIntroTitle: "Chọpụta ndị mmadụ na ohere", intents: "Ebumnuche", edit: "Dezie", youAreOffline: "Ịntanetị adịghị", offlineDiscovery: "A na-egosi ndị echekwara na ngwaọrụ a. Ndị ọhụrụ ga-apụta mgbe ị jikọtara ọzọ.",
    homeMorning: "Ụtụtụ ọma", homeAfternoon: "Ehihie ọma", homeEvening: "Mgbede ọma", homeNight: "Abalị ọma", there: "n'ebe ahụ",
  },
  yo: {
    feed: "Àkójọpọ̀ ìròyìn", forYou: "Fún ọ", following: "Àwọn tí o ń tẹ̀lé", friends: "Àwọn ọ̀rẹ́", trending: "Ohun tó gbajúmọ̀", saved: "Tí a fipamọ́",
    feedFilters: "Àwọn àlẹ̀mọ́ ìròyìn", personalizeFeed: "Ṣètò ìròyìn rẹ", feedPersonalization: "Ṣíṣe ìròyìn ní ti ara ẹni", yourFeedPriorities: "Àwọn ohun tó ṣe pàtàkì sí ọ",
    locationRelevance: "Ìbáṣepọ̀ pẹ̀lú ibi", nearby: "Nítòsí", country: "Orílẹ̀-èdè", worldwide: "Gbogbo àgbáyé", whatMattersNow: "Ohun tó ṣe pàtàkì báyìí",
    balanced: "Dọ́gba", connections: "Ìbáṣepọ̀", professional: "Ọ̀jọ̀gbọ́n", matching: "Ìbámu", focusMode: "Ipò ìfojúsùn", focusModeHelp: "Dín àwọn ohun tí kò ṣe pàtàkì kù, kí o sì fi àwọn tó bá ọ mu hàn síi.", reset: "Tún bẹ̀rẹ̀",
    searchFeed: "Wá nínú ìròyìn", searchPosts: "Wá ìtẹ̀jáde, ènìyàn, hashtags…", refreshFeed: "Tún ìròyìn ṣe", offlineFeed: "Kò sí ìsopọ̀ — a ń fi àwọn ìròyìn tó wà hàn. Àwọn ìgbésẹ̀ tuntun lè nílò ìsopọ̀.", draftsOnDevice: "Àwọn àkọsílẹ̀ àfipamọ́ lórí ẹ̀rọ yìí",
    discover: "Ṣàwárí", communities: "Àwọn àwùjọ", clearSearch: "Pa ìwádìí rẹ́", cancel: "Fagilé",
    people: "Àwọn ènìyàn", professionals: "Àwọn ògbóǹtarìgì", collaborators: "Àwọn alábàáṣiṣẹ́", mentors: "Àwọn olùtọ́sọ́nà", events: "Àwọn ìṣẹ̀lẹ̀", activities: "Àwọn ìṣe", services: "Àwọn iṣẹ́",
    searchPeople: "Wá ènìyàn àti ohun tó fẹ́ràn…", connectionFilters: "Àwọn àlẹ̀mọ́ ìbáṣepọ̀", onlineNow: "Wọ́n wà lórí ayélujára báyìí", presenceOffline: "A kò rí ipò ayélujára", discoveryOutcome: "Àbájáde ìwádìí",
    discoveryIntroTitle: "Ṣàwárí ènìyàn àti àǹfààní", intents: "Ète", edit: "Ṣàtúnṣe", youAreOffline: "O kò sí lórí ayélujára", offlineDiscovery: "A ń fi àwọn ènìyàn tó wà lórí ẹ̀rọ yìí hàn. Àwọn tuntun yóò wá nígbà tí o bá tún sopọ̀.",
    homeMorning: "Ẹ káàárọ̀", homeAfternoon: "Ẹ káàsán", homeEvening: "Ẹ kúrọ̀lẹ́", homeNight: "Ẹ káalẹ́", there: "ọ̀rẹ́",
  },
  pcm: {
    feed: "Feed", forYou: "For You", following: "People wey you dey follow", friends: "Friends", trending: "Wetin dey trend", saved: "Saved",
    feedFilters: "Feed filters", personalizeFeed: "Arrange your feed", feedPersonalization: "Feed settings", yourFeedPriorities: "Wetin matter pass to you",
    locationRelevance: "Location matter", nearby: "Near you", country: "Country", worldwide: "Everywhere", whatMattersNow: "Wetin matter now",
    balanced: "Balance", connections: "Connections", professional: "Professional", matching: "Matching", focusMode: "Focus mode", focusModeHelp: "Reduce posts wey no too matter and show the ones wey fit you well.", reset: "Reset",
    searchFeed: "Search feed", searchPosts: "Search posts, people, hashtags…", refreshFeed: "Refresh feed", offlineFeed: "Network no dey — na available feed data we dey show. Some new actions fit need connection.", draftsOnDevice: "Drafts for this device",
    discover: "Discover", communities: "Communities", clearSearch: "Clear search", cancel: "Cancel",
  people: "People", professionals: "Professionals", collaborators: "Collaborators", mentors: "Mentors", events: "Events", activities: "Activities", services: "Services",
    searchPeople: "Search people and wetin dem like…", connectionFilters: "Connection filters", onlineNow: "Dem dey online now", presenceOffline: "Presence no dey", discoveryOutcome: "Discovery result",
    discoveryIntroTitle: "Find people and better opportunities", intents: "Intents", edit: "Edit", youAreOffline: "You no dey online", offlineDiscovery: "We dey show people wey don dey this device. New people go load when you connect again.",
    homeMorning: "Good morning", homeAfternoon: "Good afternoon", homeEvening: "Good evening", homeNight: "Good night", there: "there",
  },
}

export function getExperienceMessage(key: ExperienceMessageKey, locale = "en-US"): string {
  const language = String(locale || "en").trim().toLowerCase().split(/[-_]/)[0] as ExperienceLocale
  if (language === "en") return EN[key]
  if (language === "ha" || language === "ig" || language === "yo" || language === "pcm") return PACKS[language][key] ?? EN[key]
  return EN[key]
}

export function getExperienceTranslationStatus(locale = "en-US"): "complete" | "partial" | "none" {
  const language = String(locale || "en").trim().toLowerCase().split(/[-_]/)[0]
  return language === "en" ? "complete" : ["ha", "ig", "yo", "pcm"].includes(language) ? "partial" : "none"
}

export function getExperienceCoverage(): Readonly<{ keys: number; locales: number; reviewRequired: true }> {
  return Object.freeze({ keys: Object.keys(EN).length, locales: 4, reviewRequired: true as const })
}
