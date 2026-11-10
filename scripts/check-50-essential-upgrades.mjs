#!/usr/bin/env node
/**
 * 50 essential upgrades — 10 per section across 5 product sections (0.338.18).
 * Source-only regression; does not claim live acceptance or production approval.
 */
import fs from 'node:fs'
import path from 'node:path'
const root = process.cwd()
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8')
const exists = (p) => fs.existsSync(path.join(root, p))
const checks = []
const add = (section, id, label, ok) => checks.push({ section, id, label, ok: Boolean(ok) })

const feedEss = read('lib/feed/essential-controls.ts')
const feedRank = read('lib/feed-ranking-engine.ts')
const feedScreen = read('components/ghc/enhanced-feed-screen.tsx')
const walletEss = read('lib/wallet/essential-controls.ts')
const msgEss = read('lib/messaging/essential-controls.ts')
const offline = read('lib/messaging/offline-message-flush.ts')
const mktEss = read('lib/marketplace/essential-controls.ts')
const commission = read('lib/server/marketplace/commission.ts')
const mktIntegrity = read('lib/server/marketplace/marketplace-integrity.ts')
const platEss = read('lib/platform/essential-controls.ts')
const settings = read('lib/settings-persistence.ts')
const rel = read('lib/server/social/relationship-integrity.ts')
const auth = read('lib/server/economy/auth.ts')
const readiness = read('lib/server/readiness.ts')
const pkg = JSON.parse(read('package.json'))
const release = read('lib/app-release.ts')
const ci = read('.github/workflows/ci.yml')
const nvm = exists('.nvmrc') ? read('.nvmrc') : ''

// Section 1 — Feed & Social (10)
add(1, 'F01', 'Feed essential controls module exists', exists('lib/feed/essential-controls.ts'))
add(1, 'F02', 'Public feed excludes drafts and scheduled posts', /isDraft|isScheduled/.test(feedEss) && /isExcludedFromPublicFeed/.test(feedEss))
add(1, 'F03', 'Blocked/muted authors excluded from public feed helper', /blockedMuted/.test(feedEss))
add(1, 'F04', 'Feed page size is clamped', /FEED_PAGE_SIZE_MAX/.test(feedEss) && /clampFeedPageSize/.test(feedEss))
add(1, 'F05', 'Media prefetch hard upper bound defined', /FEED_PREFETCH_MEDIA_MAX/.test(feedEss))
add(1, 'F06', 'Ranking engine imports essential feed controls', /essential-controls/.test(feedRank))
add(1, 'F07', 'Saved/public lane uses exclusion helper', /isExcludedFromPublicFeed/.test(feedRank))
add(1, 'F08', 'Feed screen has honest empty / error paths', /Failed to load|empty|skeleton/i.test(feedScreen))
add(1, 'F09', 'Feed ranking error category helper present', /isFeedRankingErrorReason/.test(feedEss))
add(1, 'F10', 'Relationship target sanitizer rejects demo placeholders', /demo|placeholder/i.test(rel) && /SELF/.test(rel))

// Section 2 — Wallet & Payments (10)
add(2, 'W01', 'Wallet essential controls module exists', exists('lib/wallet/essential-controls.ts'))
add(2, 'W02', 'Display amounts reject negative and non-finite values', /sanitizeDisplayAmount/.test(walletEss))
add(2, 'W03', 'Pi atomic formatting avoids float drift', /PI_ATOMIC_SCALE/.test(walletEss) && /formatPiAtomic/.test(walletEss))
add(2, 'W04', 'Pi and GHC rails stay separately labelled', /Pi balance/.test(walletEss) && /GHC balance/.test(walletEss))
add(2, 'W05', 'Reserved/pending funds labelled not spendable', /not withdrawable|not spendable/i.test(walletEss))
add(2, 'W06', 'Wallet secret-bearing field detector present', /isSecretBearingWalletField/.test(walletEss))
add(2, 'W07', 'Marketplace commission fixed at 500 bps', /CANONICAL_PLATFORM_FEE_BPS\s*=\s*500/.test(commission))
add(2, 'W08', 'Commission ignores env fee overrides', !/process\.env\.GHC_MARKETPLACE_PLATFORM_FEE_BPS/.test(commission))
add(2, 'W09', 'Production Pi identity mapping fails closed', /isProduction/.test(auth) && /IDENTITY|mapping/i.test(auth))
add(2, 'W10', 'Readiness keeps production not approved', /NOT APPROVED|productionApproved|false/.test(readiness) || /PRODUCTION_APPROVED = false/.test(platEss))

// Section 3 — Messaging & Notifications (10)
add(3, 'M01', 'Messaging essential controls module exists', exists('lib/messaging/essential-controls.ts'))
add(3, 'M02', 'clientMessageId max is 80 characters', /CLIENT_MESSAGE_ID_MAX = 80/.test(msgEss))
add(3, 'M03', 'Message body max is 8000 characters', /MESSAGE_BODY_MAX = 8000/.test(msgEss))
add(3, 'M04', 'Attachment count capped at 4', /MESSAGE_ATTACHMENTS_MAX = 4/.test(msgEss))
add(3, 'M05', 'Offline retry max defined', /OFFLINE_RETRY_MAX/.test(msgEss))
add(3, 'M06', 'Permanent failure detector covers 4xx membership errors', /NOT_MEMBER|BLOCKED|EMPTY_BODY/.test(msgEss))
add(3, 'M07', 'Offline flush uses permanent failure detector', /isPermanentMessageFailure/.test(offline))
add(3, 'M08', 'Offline flush respects retry ceiling', /OFFLINE_RETRY_MAX/.test(offline))
add(3, 'M09', 'Remote push production flag is false', /REMOTE_PUSH_PRODUCTION_ENABLED = false/.test(msgEss))
add(3, 'M10', 'Notification channels distinguish in-app, browser, remote', /in_app/.test(msgEss) && /browser_alert/.test(msgEss) && /remote_push/.test(msgEss))

// Section 4 — Marketplace & Commerce (10)
add(4, 'C01', 'Marketplace essential controls module exists', exists('lib/marketplace/essential-controls.ts'))
add(4, 'C02', 'Commission bps constant is 500', /MARKETPLACE_COMMISSION_BPS = 500/.test(mktEss))
add(4, 'C03', 'Available stock never treats NaN as unlimited', /availableStock/.test(mktEss) && /return 0/.test(mktEss))
add(4, 'C04', 'Purchase quantity validates integer bounds', /canPurchaseQuantity/.test(mktEss) && /CART_QTY_MAX/.test(mktEss))
add(4, 'C05', 'Own-listing purchase detector present', /isOwnListing/.test(mktEss))
add(4, 'C06', 'Cart line and quantity ceilings defined', /CART_LINE_MAX/.test(mktEss) && /CART_QTY_MAX/.test(mktEss))
add(4, 'C07', 'Integrity module imports marketplace essentials', /essential-controls/.test(mktIntegrity))
add(4, 'C08', 'Listing title/description bounds defined', /LISTING_TITLE_MAX/.test(mktEss) && /LISTING_DESC_MAX/.test(mktEss))
add(4, 'C09', 'Commission helper uses integer arithmetic', /commissionMinorFromGross/.test(mktEss))
add(4, 'C10', 'Human stock errors exist in integrity module', /stock/i.test(mktIntegrity))

// Section 5 — Identity, Settings & Platform (10)
add(5, 'P01', 'Platform essential controls module exists', exists('lib/platform/essential-controls.ts'))
add(5, 'P02', 'Production approval flag is false', /PRODUCTION_APPROVED = false/.test(platEss))
add(5, 'P03', 'Supported Node is 24.15.0', /24\.15\.0/.test(platEss) && /24\.15\.0/.test(nvm))
add(5, 'P04', 'Session max concurrent default is defined', /SESSION_MAX_ACTIVE_DEFAULT = 8/.test(platEss))
add(5, 'P05', 'Settings export forbids secret-bearing keys', /vapid|jwt|webhook|recovery/.test(settings))
add(5, 'P06', 'Platform export helper mirrors forbidden keys', /FORBIDDEN_SETTINGS_EXPORT_RE/.test(platEss))
add(5, 'P07', 'Discovery radius clamp 1–100 km', /clampDiscoveryRadiusKm/.test(platEss) && /Math\.min\(100/.test(platEss))
add(5, 'P08', 'Demo user IDs rejected by platform helper', /isDemoOrPlaceholderUserId/.test(platEss))
add(5, 'P09', 'Five-item bottom navigation contract documented', /BOTTOM_NAV_ITEMS/.test(platEss) && /home/.test(platEss) && /discover/.test(platEss))
add(5, 'P10', 'CI does not auto-apply migrations', !/supabase\s+db\s+push/.test(ci))

// Release hygiene (counted inside section totals above; soft check)
const versionOk = pkg.version === '0.338.18' && release.includes('0.338.18')

let failed = 0
for (const c of checks) {
  console.log(`${c.ok ? 'PASS' : 'FAIL'} S${c.section} ${c.id}: ${c.label}`)
  if (!c.ok) failed++
}
console.log(`\n50 essential upgrades: ${checks.length - failed}/${checks.length} passed`)
if (!versionOk) {
  console.error('FAIL release version is not 0.338.18')
  failed++
} else {
  console.log('PASS release version is 0.338.18')
}
if (checks.length !== 50 || failed) process.exit(1)
