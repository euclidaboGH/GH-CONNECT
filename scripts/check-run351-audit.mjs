#!/usr/bin/env node
import { readFileSync } from 'node:fs'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const app = read('components/ghc/app.tsx')
const card = read('components/ghc/enhanced-post-card.tsx')
const tx = read('components/ghc/ghc-transaction-detail.tsx')
const guards = read('lib/curation/client-curation-guards.ts')
const wallet = read('lib/active-upgrades/wallet.ts')
const market = read('lib/active-upgrades/marketplace.ts')
const memUp = read('lib/active-upgrades/membership.ts')
const memDomain = read('lib/domains/membership-domain.ts')

const checks = [
  // Shell / overlays
  ['short video renders independently of the create hub', /showShortVideo \? \(\s*<Suspense fallback=\{null\}>\s*<ShortVideoScreen/.test(app) && !/\{showShortVideo && \(/.test(app)],
  ['every full-screen overlay renders the toast host', (app.match(/renderToastHost\(false\)/g) || []).length === 4 && /renderToastHost\(true\)/.test(app)],
  ['all five shells (main + four overlays) mount the global interaction dialog', (app.match(/<GlobalInteractionDialog \/>/g) || []).length >= 5],
  ['single closeAllOverlays used by navigation, chat, post and profile entry points', /const closeAllOverlays = useCallback/.test(app) && /ghc:close-overlays/.test(app) && (app.match(/closeAllOverlays\(\)/g) || []).length >= 4],
  ['openWallet dismisses settings and ecosystem', /const openWallet = useCallback\(\(\) => \{[\s\S]{0,400}setSettingsOpen\(false\)[\s\S]{0,200}setEcosystemOpen\(false\)/.test(app)],
  ['digit shortcuts disabled while marketplace/ecosystem overlays are open', /settingsOpen \|\| walletOpen \|\| marketplaceOpen \|\| ecosystemOpen/.test(app)],
  ['toast timers are keyed per toast and errors last longer', /toastTimersRef/.test(app) && /6500/.test(app)],
  ['boot spinners offer a reload escape without forcing registration', (app.match(/<BootRetryHint \/>/g) || []).length === 2 && !/setOnboardingForced|forceRegistration/.test(app)],
  ['error boundary only shows Close when the overlay can be closed', /\{onDismiss \? \(/.test(app)],
  ['attention polling skips hidden tabs', /visibilityState === "hidden"\) return/.test(app)],
  ['async startConversation rejections are handled', (app.match(/\.catch\(\(\) => addToast\("Could not open this conversation/g) || []).length >= 3],
  ['unused shell imports removed', !/\bHeart\b|\bShoppingBag\b|SessionResumeToast/.test(app)],
  // Post card
  ['block author asks for confirmation', /Block \$\{displayAuthor\}\?/.test(card)],
  ['mentions are not dead buttons in read-only previews', /if \(readOnly \|\| !onOpenProfile\)/.test(card)],
  ['edit dialog closes on Escape and skips no-op saves', /event\.key === "Escape" && !editMediaBusy/.test(card) && /Saving without changes must not stamp/.test(card)],
  ['upload failures are reported, not swallowed', /could not be uploaded/.test(card)],
  ['post card no longer imports unused nextCurationChoice', !/nextCurationChoice/.test(card)],
  ['curation fallback detection uses shared helper, not a duplicated string', /isKnownCurationError/.test(card) && !/"Could not update curation\. Try again\."/.test(card)],
  // Transactions
  ['transaction amount never renders unknown as zero', /if \(!Number\.isFinite\(n\)\) return "—"/.test(tx)],
  ['transaction references memoized', /const correlationReferences = useMemo/.test(tx)],
  // Helpers
  ['rate-limit copy no longer claims a daily limit', !/RATE_LIMITED":\s*\n\s*return "Daily/.test(guards) && /voting too quickly/.test(guards)],
  ['wallet helpers reject null/blank as balances', /typeof candidate !== "number" && typeof candidate !== "string"/.test(wallet) && /fabricate a balance/.test(wallet)],
  ['missing stock is unknown, not out of stock', /function stockFigure/.test(market)],
  ['membership default error shared by constant', /MEMBERSHIP_DEFAULT_ERROR/.test(memUp) && /MEMBERSHIP_DEFAULT_ERROR/.test(memDomain)],
  ['anchorless trial record cannot grant an endless trial', /trial that never ends/.test(memDomain) && !/trialAnchorAt \|\| s\.startedAt \|\| now/.test(memDomain)],
]

let failed = 0
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  if (!ok) failed++
}
console.log(`\nRUN351 audit: ${checks.length - failed}/${checks.length} passed`)
process.exit(failed ? 1 : 0)
