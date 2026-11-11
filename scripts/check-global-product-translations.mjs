import fs from 'node:fs'
const read = (file) => fs.readFileSync(file, 'utf8')
const product = read('lib/i18n/product.ts')
const screens = {
  messages: read('components/ghc/message-screen.tsx'),
  communities: read('components/ghc/communities-screen.tsx'),
  marketplace: read('components/ghc/marketplace-screen.tsx'),
  settings: read('components/ghc/settings.tsx'),
  profile: read('components/ghc/profile-screen.tsx'),
  rewards: read('components/ghc/rewards-centre-screen.tsx'),
}
const keys = ['messagesTitle','messagesSubtitle','all','directMessages','unread','requests','communities','markAllRead','new','offlineNotice','communityTitle','create','searchCommunity','myCommunities','discover','marketplaceTitle','buySellSubtitle','browse','sell','sellerCentre','orders','saved','categories','searchListings','settingsTitle','searchSettings','back','clearSearch','loading','retry','save','cancel','translationNotice']
const checks = [
  ['typed product-surface catalog covers core interface terms', keys.every((key) => product.includes(`\"${key}\"`))],
  ['Hausa, Igbo, Yoruba and Pidgin packs exist', ['ha:', 'ig:', 'yo:', 'pcm:'].every((key) => product.includes(key))],
  ['English is the canonical fallback for missing translations', product.includes('?? EN[key]')],
  ['unsupported locales remain English', product.includes('return EN[key]')],
  ['messages inbox uses selected locale for heading and filters', screens.messages.includes('getProductMessage') && screens.messages.includes('msg("messagesTitle")') && screens.messages.includes('msg("directMessages")')],
  ['community discovery uses selected locale for heading and search', screens.communities.includes('msg("communityTitle")') && screens.communities.includes('msg("searchCommunity")')],
  ['marketplace uses selected locale for commerce navigation', screens.marketplace.includes('msg("marketplaceTitle")') && screens.marketplace.includes('msg("searchListings")')],
  ['settings uses selected locale for settings discovery', screens.settings.includes('msg("settingsTitle")') && screens.settings.includes('msg("searchSettings")')],
  ['profile identity and dashboard labels follow selected locale', screens.profile.includes('msg("profileTitle")') && screens.profile.includes('msg("dashboard")')],
  ['rewards centre navigation follows selected locale', screens.rewards.includes('msg("rewardsTitle")') && screens.rewards.includes('msg("achievements")')],
  ['user-authored content and transaction logic are not translated by this catalog', !product.includes('translateUserContent') && !product.includes('walletBalance') && !product.includes('paymentStatus')],
  ['translation quality is explicitly identified as preview', product.includes('preview translations') && product.includes('independently reviewed')],
]
let failures = 0
for (const [name, pass] of checks) { console.log(`${pass ? 'PASS' : 'FAIL'} ${name}`); if (!pass) failures++ }
if (failures) process.exit(1)
console.log(`Global product translations: PASS (${checks.length}/${checks.length})`)
