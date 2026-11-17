/** Phase 6 workflow language packs. Preview translations only; review is mandatory. */
export const WORKFLOW_MESSAGES = {
  composeTitle: "Create a post", newStory: "New story", publish: "Publish", posting: "Publishing…", share: "Share", sharing: "Sharing…", composeOffline: "You’re offline — your draft stays on this device. Reconnect to publish.", communityBoard: "Community board (optional)", personalFeed: "Personal feed only", alsoCommunity: "This will also appear on the community board and will respect your visibility setting.",
  editProfile: "Edit profile", displayName: "Display name", yourName: "Your name", bio: "Bio", tellAbout: "Tell people about yourself…", aboutDetails: "About details", profession: "Work / profession", education: "Education", hometown: "Hometown", interests: "Interests", saveProfile: "Save profile", saving: "Saving…", profileSaveError: "Could not save your profile. Please try again.",
  board: "Community board", boardPostsEvents: "Board = posts and events · Chat = member conversation.", writeBoardPost: "Write a community update",
  editListing: "Edit listing", sellMarketplace: "Sell on Marketplace", photos: "Photos", listingTitle: "Listing title", price: "Price", description: "Description", listingFeeNotice: "Listing fees are non-refundable. Review the fee and payment details before publishing.", publishListing: "Publish listing", saveListing: "Save listing",
  walletAvailable: "Available balance", walletActivity: "Wallet activity", transactionHistory: "Transaction history", walletReadOnlyNotice: "Balances and transaction records are shown exactly as returned by the wallet service.",
} as const
export type WorkflowMessageKey = keyof typeof WORKFLOW_MESSAGES
const PACKS: Record<"ha" | "ig" | "yo" | "pcm", Partial<Record<WorkflowMessageKey, string>>> = {
  ha: {
    composeTitle: "Ƙirƙiri rubutu", newStory: "Sabon labari", publish: "Wallafa", posting: "Ana wallafawa…", share: "Raba", sharing: "Ana rabawa…", composeOffline: "Babu intanet — daftarin ka zai kasance a wannan na'ura. Haɗa intanet don wallafawa.", communityBoard: "Allon al'umma (na zaɓi)", personalFeed: "Ciyarwarka kawai", alsoCommunity: "Za a nuna wannan a allon al'umma kuma zai bi saitin wanda zai iya gani.",
    editProfile: "Gyara bayanan martaba", displayName: "Sunan nuni", yourName: "Sunanka", bio: "Takaitaccen bayani", tellAbout: "Faɗa wa mutane game da kanka…", aboutDetails: "Ƙarin bayani", profession: "Aiki / sana'a", education: "Ilimi", hometown: "Garin asali", interests: "Abubuwan sha'awa", saveProfile: "Ajiye bayanan martaba", saving: "Ana ajiyewa…", profileSaveError: "Ba a iya ajiye bayanan martabarka ba. Sake gwadawa.",
    board: "Allon al'umma", boardPostsEvents: "Allo = rubuce-rubuce da abubuwan da ke faruwa · Chat = tattaunawar mambobi.", writeBoardPost: "Rubuta sanarwar al'umma",
    editListing: "Gyara kaya", sellMarketplace: "Sayar a kasuwa", photos: "Hotuna", listingTitle: "Sunan kaya", price: "Farashi", description: "Bayani", listingFeeNotice: "Ba a mayar da kuɗin wallafa kaya. Duba kuɗi da bayanan biyan kuɗi kafin wallafawa.", publishListing: "Wallafa kaya", saveListing: "Ajiye kaya",
    walletAvailable: "Ma'aunin da ake da shi", walletActivity: "Ayyukan wallet", transactionHistory: "Tarihin ma'amaloli", walletReadOnlyNotice: "Ana nuna ma'auni da bayanan ma'amala kamar yadda sabis ɗin wallet ya bayar.",
  },
  ig: {
    composeTitle: "Mepụta ihe ị ga-ebipụta", newStory: "Akụkọ ọhụrụ", publish: "Bipụta", posting: "A na-ebipụta…", share: "Kesaa", sharing: "A na-ekesa…", composeOffline: "Ịntanetị adịghị — draft gị ga-adị na ngwaọrụ a. Jikọọ ọzọ tupu ibipụta.", communityBoard: "Board obodo (nhọrọ)", personalFeed: "Ndepụta nke gị naanị", alsoCommunity: "A ga-egosikwa nke a na board obodo ma soro ntọala onye nwere ike ịhụ ya.",
    editProfile: "Dezie profaịlụ", displayName: "Aha ngosi", yourName: "Aha gị", bio: "Nkọwa onwe gị", tellAbout: "Gwa ndị mmadụ gbasara onwe gị…", aboutDetails: "Nkọwa ndị ọzọ", profession: "Ọrụ / Ọkachamara", education: "Agụmakwụkwọ", hometown: "Obodo gị", interests: "Ihe masịrị gị", saveProfile: "Chekwaa profaịlụ", saving: "Na-echekwa…", profileSaveError: "Enweghị ike ichekwa profaịlụ gị. Biko nwaa ọzọ.",
    board: "Board obodo", boardPostsEvents: "Board = ihe e bipụtara na mmemme · Chat = mkparịta ụka ndị otu.", writeBoardPost: "Dee ozi obodo",
    editListing: "Dezie ngwaahịa", sellMarketplace: "Ree na Marketplace", photos: "Foto", listingTitle: "Aha ngwaahịa", price: "Ọnụahịa", description: "Nkọwa", listingFeeNotice: "A naghị akwụghachi ụgwọ ibipụta ngwaahịa. Lelee ụgwọ na nkọwa ịkwụ ụgwọ tupu ibipụta.", publishListing: "Bipụta ngwaahịa", saveListing: "Chekwaa ngwaahịa",
    walletAvailable: "Ego dị", walletActivity: "Ihe omume wallet", transactionHistory: "Akụkọ azụmahịa", walletReadOnlyNotice: "A na-egosi ego na ndekọ azụmahịa dịka ọrụ wallet si wepụta ha.",
  },
  yo: {
    composeTitle: "Ṣẹ̀dá ìtẹ̀jáde", newStory: "Ìtàn tuntun", publish: "Tẹ̀ jáde", posting: "Ó ń tẹ̀ jáde…", share: "Pín", sharing: "Ó ń pín…", composeOffline: "Kò sí ìsopọ̀ — àkọpamọ́ rẹ yóò wà lórí ẹ̀rọ yìí. Sopọ̀ kí o tó tẹ̀ jáde.", communityBoard: "Pátákó àwùjọ (àṣàyàn)", personalFeed: "Ìròyìn tìrẹ nìkan", alsoCommunity: "Èyí yóò tún hàn lórí pátákó àwùjọ, yóò sì tẹ̀lé ètò ìfarahàn rẹ.",
    editProfile: "Ṣàtúnṣe profaili", displayName: "Orúkọ ìfihàn", yourName: "Orúkọ rẹ", bio: "Àlàyé nípa rẹ", tellAbout: "Sọ fún àwọn ènìyàn nípa ara rẹ…", aboutDetails: "Àwọn àlàyé míì", profession: "Iṣẹ́ / Ọ̀jọ̀gbọ́n", education: "Ẹ̀kọ́", hometown: "Ìlú ìbílẹ̀", interests: "Àwọn ohun tó fẹ́ràn", saveProfile: "Fi profaili pamọ́", saving: "Ó ń fipamọ́…", profileSaveError: "A kò lè fi profaili rẹ pamọ́. Jọ̀wọ́ tún gbìyànjú.",
    board: "Pátákó àwùjọ", boardPostsEvents: "Pátákó = ìtẹ̀jáde àti ìṣẹ̀lẹ̀ · Ìjíròrò = ọ̀rọ̀ àwọn ọmọ ẹgbẹ́.", writeBoardPost: "Kọ ìròyìn àwùjọ",
    editListing: "Ṣàtúnṣe ọjà", sellMarketplace: "Ta ní ọjà", photos: "Àwọn fọ́tò", listingTitle: "Orúkọ ọjà", price: "Iye owó", description: "Àpèjúwe", listingFeeNotice: "A kò lè dá owó ìtẹ̀jáde ọjà padà. Ṣàyẹ̀wò owó àti ìsanwó kí o tó tẹ̀ jáde.", publishListing: "Tẹ̀ ọjà jáde", saveListing: "Fi ọjà pamọ́",
    walletAvailable: "Ìwọ̀ntúnwọ̀nsì tó wà", walletActivity: "Ìṣe wallet", transactionHistory: "Àkọsílẹ̀ ìṣòwò", walletReadOnlyNotice: "A ń fi ìwọ̀ntúnwọ̀nsì àti àkọsílẹ̀ ìṣòwò hàn gẹ́gẹ́ bí iṣẹ́ wallet ṣe padà wọn.",
  },
  pcm: {
    composeTitle: "Create post", newStory: "New story", publish: "Publish", posting: "E dey publish…", share: "Share", sharing: "E dey share…", composeOffline: "Network no dey — your draft go remain for this device. Connect before you publish.", communityBoard: "Community board (optional)", personalFeed: "Only my feed", alsoCommunity: "E go also show for the community board and follow your visibility setting.",
    editProfile: "Edit profile", displayName: "Display name", yourName: "Your name", bio: "About you", tellAbout: "Tell people about yourself…", aboutDetails: "More about you", profession: "Work / profession", education: "Education", hometown: "Where you come from", interests: "Wetin you like", saveProfile: "Save profile", saving: "E dey save…", profileSaveError: "We no fit save your profile. Abeg try again.",
    board: "Community board", boardPostsEvents: "Board na posts and events · Chat na members conversation.", writeBoardPost: "Write community update",
    editListing: "Edit listing", sellMarketplace: "Sell for Marketplace", photos: "Photos", listingTitle: "Listing title", price: "Price", description: "Description", listingFeeNotice: "Listing fee no dey refundable. Check the fee and payment details before you publish.", publishListing: "Publish listing", saveListing: "Save listing",
    walletAvailable: "Available balance", walletActivity: "Wallet activity", transactionHistory: "Transaction history", walletReadOnlyNotice: "We dey show balance and transaction records exactly as wallet service return am.",
  },
}
export function getWorkflowMessage(key: WorkflowMessageKey, locale = "en-US"): string {
  const language = String(locale || "en").trim().toLowerCase().split(/[-_]/)[0]
  if (language === "ha" || language === "ig" || language === "yo" || language === "pcm") return PACKS[language][key] ?? WORKFLOW_MESSAGES[key]
  return WORKFLOW_MESSAGES[key]
}
export function getWorkflowTranslationStatus(locale = "en-US"): "complete" | "partial" | "none" {
  const language = String(locale || "en").trim().toLowerCase().split(/[-_]/)[0]
  return language === "en" ? "complete" : ["ha", "ig", "yo", "pcm"].includes(language) ? "partial" : "none"
}
