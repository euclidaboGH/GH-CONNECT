import assert from 'node:assert/strict'
const modules = ['community','chat','connections','matches','marketplace','orders','wallet','ghc','pi-payments','rewards','membership']
const loaded = Object.fromEntries(await Promise.all(modules.map(async name => [name, await import(`../lib/active-upgrades/${name}.ts`)])))
let checks = 0
const check = (condition, message) => { assert.ok(condition, message); checks++ }
const c = loaded.community
check(c.normalizeCommunitySearch('  Green\n Haven  ') === 'Green Haven', 'community search normalization')
check(c.normalizeCommunitySearch('x'.repeat(200)).length === 120, 'community search bound')
check(c.clampCommunityPage(49, 24) === 2, 'community page clamp')
check(c.safeCommunityResourceUrl('javascript:alert(1)') === null, 'community URL scheme')
check(c.canShowCommunityChat({isMember:true,chatEnabled:true}) && !c.canShowCommunityChat({isMember:true,chatEnabled:true,revoked:true}), 'community chat revocation')
const chat = loaded.chat
check(chat.normalizeMessageDraft('a\r\nb') === 'a\nb', 'chat newline normalization')
check(chat.validateMessageDraft('  ') === 'empty', 'chat empty validation')
check(chat.validateMessageDraft('hello') === 'valid', 'chat valid draft')
check(chat.normalizeMessageSearch(' a\n b ').length > 0, 'chat search normalization')
check(chat.stableOfflineMessageId('a/b') === 'offline-ab', 'stable offline message id')
const con = loaded.connections
check(con.normalizeConnectionTarget('user_123') === 'user_123', 'connection target accepted')
check(con.normalizeConnectionTarget('placeholder') === null, 'placeholder target rejected')
check(!con.canRequestConnection({viewerId:'user_123',targetId:'user_123'}), 'self connection rejected')
check(con.normalizeConnectionIntentIds(['friendship','invalid','friendship'],['friendship']).length === 1, 'connection intents deduped')
check(con.mutualConnectionCount(-1) === 0, 'mutual count nonnegative')
const matches = loaded.matches
check(matches.matchConfidenceBand(90) === 'strong', 'match confidence strong')
check(matches.matchConfidenceBand(101) === 'unknown', 'match confidence bounds')
check(matches.normalizeMatchSearch(' hello ').trim() === 'hello', 'match search normalization')
check(matches.matchReasonLabels(['shared_interests','sql']).length === 1, 'match reason allowlist')
check(!matches.canSendMatchSignal({viewerId:'a',targetId:'b',eligible:false}), 'match signal eligibility')
const market = loaded.marketplace
check(market.safeListingQuantity(2, 5) === 2, 'listing quantity')
check(market.safeListingQuantity(2, 0) === 0, 'zero stock preserved')
check(market.normalizeListingSearch('  shoes  ') === 'shoes', 'listing search')
check(market.listingAvailability(0) === 'out_of_stock', 'out of stock')
check(!market.canAddListingToCart({listingActive:true,ownListing:true,stock:2}), 'own listing blocked')
const orders = loaded.orders
check(orders.isTerminalOrderStatus('completed'), 'terminal order')
check(!orders.isTerminalOrderStatus('fulfilling'), 'nonterminal order')
check(orders.buyerCanConfirmDelivery('delivered'), 'buyer delivery confirmation state')
check(orders.sellerCanStartFulfilment('confirmed'), 'seller fulfilment state')
check(orders.orderStatusLabel('payment_pending') === 'Awaiting payment', 'order status label')
const wallet = loaded.wallet
check(wallet.spendableAmount(100, 30) === 70, 'wallet reserved amount')
check(wallet.spendableAmount(10, 20) === 0, 'wallet no negative spendable')
check(wallet.spendableAmount(-1, 0) === 0, 'wallet invalid atomic values')
check(wallet.withdrawalDisplayState({consentRequired:true}) === 'consent', 'wallet consent state')
check(wallet.walletAssetLabel('pi') === 'PI' && wallet.walletAssetLabel('btc') === 'Unknown asset', 'wallet asset separation')
const ghc = loaded.ghc
check(ghc.normalizeGhcRecipient('user_123') === 'user_123', 'GHC recipient')
check(ghc.normalizeGhcRecipient('x') === null, 'GHC recipient bounds')
check(ghc.isGhcRequestExpired(1000, 1000), 'GHC expiry inclusive boundary')
check(ghc.ghcRequestAction('PENDING', 1000, 1000) === 'wait', 'expired GHC request not payable')
check(ghc.ghcAmountInputState('0.25') === 'valid', 'GHC amount input')
const pi = loaded['pi-payments']
check(pi.piPaymentState('completed') === 'verified', 'Pi payment verified state')
check(pi.piPaymentState('pending') === 'pending', 'Pi payment pending state')
check(pi.piPaymentState('unknown-provider-state') === 'unknown', 'Pi payment unknown state')
check(pi.shouldOfferPaymentRecovery({status:'pending',hasIntentId:true}), 'Pi recovery availability')
check(!pi.shouldOfferPaymentRecovery({status:'completed',hasIntentId:true}), 'no recovery after verified')
const rewards = loaded.rewards
check(rewards.rewardProgressPercent(5,10) === 50, 'reward progress')
check(rewards.rewardProgressPercent(20,10) === 100, 'reward progress capped')
check(rewards.rewardClaimState('claimable') === 'available', 'reward claim state')
check(rewards.rewardClaimState('processing') === 'pending', 'reward processing state')
check(rewards.rewardClaimButtonLabel('claimed') === 'Claimed', 'reward button label')
const membership = loaded.membership
check(membership.membershipExpiryState({active:true,expiresAt:2000,now:1000}) === 'expiring', 'membership expiry warning')
check(membership.membershipExpiryState({active:true,expiresAt:1000,now:1000}) === 'expired', 'membership expiry boundary')
check(membership.membershipDaysRemaining(86400000,0) === 1, 'membership days remaining')
check(membership.membershipTierLabel('vvip') === 'VVIP', 'membership tier label')
check(membership.entitlementLabel('priority_support') === 'Priority Support', 'membership entitlement label')
console.log(`Run #283 active-module upgrade tests: ${checks}/${checks} PASS across ${modules.length} modules`)
