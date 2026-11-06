#!/usr/bin/env node
/** Phase 28 — static gate: genuine Pi wallet consent precedes any withdrawal quote. */
import { readFileSync } from "node:fs"
import { join } from "node:path"
const root = process.cwd()
const read = (p) => readFileSync(join(root, p), "utf8")
const route = read("app/api/identity/wallet-authorization/route.ts")
const lib = read("lib/server/identity/wallet-consent.ts")
const helper = read("lib/client/pi-wallet-consent.ts")
const sheet = read("components/ghc/pi-withdraw-sheet.tsx")
const card = read("components/ghc/pi-payout-authorization-card.tsx")
const dash = read("components/ghc/unified-earnings-dashboard.tsx")
const quoteRoute = read("app/api/economy/earnings/quote/route.ts")
const quoteSql = read("supabase/migrations/20261029010011_gh_earnings_withdrawal_fee_3pct.sql")
const grantSql = read("supabase/migrations/20261105160001_pi_wallet_authorization_explicit_consent_only.sql")
const pkg = JSON.parse(read("package.json"))
const results = []
const test = (name, ok) => { results.push(Boolean(ok)); console.log(`${ok ? "PASS" : "FAIL"} ${name}`) }
const postPost = route.slice(route.indexOf("export async function POST"), route.indexOf("export async function DELETE"))

test("grant route verifies fresh Pi proof before any grant RPC", postPost.indexOf("verifyWalletConsentProof") > -1 && postPost.indexOf("verifyWalletConsentProof") < postPost.indexOf("grantWalletAuthorization"))
test("grant route uses trusted server verification (Pi /v2/me) and the durable mapping", /verifyPiAccessToken/.test(postPost) && /getByGhUserId/.test(postPost) && /getByPiAppUid/.test(postPost))
test("grant route never reads recipient/user/authorized from the body", !/body\.(piAppUid|recipient|ghUserId|userId|authorized)/.test(postPost) && !/parsedBody\.value\.(piAppUid|recipient|ghUserId|userId|authorized)/.test(postPost))
test("grant route only forwards the user_explicit source", /source: "user_explicit"/.test(postPost) && !/auth_bridge|operator/.test(postPost))
test("grant route reads the authorization back and checks UID match", /verified\.authorizationActive !== true/.test(postPost) && /verified\.authorizedPiAppUid !== mapping\.piAppUid/.test(postPost))
test("explicit consent must be the literal boolean true", /input\.consent !== true/.test(lib))
test("verified UID must equal the durable mapping AND resolve back to the same GH account", /mapping\.piAppUid !== piUser\.uid/.test(lib) && /reverse\.ghUserId !== ghUserId/.test(lib))
test("access token is never stored or logged server-side", !/console\.(log|info|error)\([^)]*accessToken/.test(route + lib) && !/localStorage|sessionStorage/.test(helper))
test("client helper uses the official Pi SDK authenticate and sends token+consent", /piAuthenticateOfficial/.test(helper) && /JSON\.stringify\(\{ accessToken, consent: true \}\)/.test(helper))
test("client helper re-reads authorization from the status endpoint (no browser flag)", /fetchWalletAuthorizationStatus\(\)/.test(helper) && /AUTHORIZATION_NOT_CONFIRMED/.test(helper))
test("no component posts an empty/blind body to wallet-authorization", ![sheet, card, dash].some((s) => /method: "POST"[\s\S]{0,200}wallet-authorization|wallet-authorization[\s\S]{0,200}method: "POST"/.test(s)))
test("sheet quote entry re-verifies authorization before requesting a quote", /const onQuote = async/.test(sheet) && /auth\?\.authorizationActive === true \? await loadAuth\(\) : false/.test(sheet))
test("Preview fee is disabled until authorization is active", /needsConsent \|\| auth === null \|\| amountPi <= 0/.test(sheet))
test("successful consent continues automatically to the quote", /onAuthorizeAndContinue/.test(sheet) && /if \(ok\) await runQuote\(\)/.test(sheet))
test("submit requires a quote for the exact amount before confirmation", /quote\.amountAtomic !== floorToAtomic\(amountPi\)/.test(sheet) && /Confirm withdrawal/.test(sheet))
test("sheet shows fee, net, destination and cancel in the consent dialog", /Authorize your Pi wallet for withdrawals/.test(sheet) && /3% platform fee/.test(sheet) && /Cancel/.test(sheet) && /Retry Pi authentication/.test(sheet))
test("sheet never prints raw HTTP/error-code strings to users", !/HTTP \$\{/.test(sheet) && !/HTTP \$\{/.test(card))
test("dashboard hands off to the sheet instead of authorizing blindly", /openWithdrawSheet/.test(dash) && !/onAuthorizeWallet/.test(dash))
test("quote route still delegates to the DB quote function (authorization check not bypassed)", /quoteWithdrawal\(\{ userId: auth\.userId, grossAtomic \}\)/.test(quoteRoute))
test("DB quote function still enforces WALLET_AUTHORIZATION_REQUIRED", /WALLET_AUTHORIZATION_REQUIRED/.test(quoteSql) && /gh_pi_wallet_authorizations/.test(quoteSql))
test("grant RPC remains service_role-only and user_explicit-only (no new grants to authenticated/anon)", /TO service_role/.test(grantSql) && /FROM PUBLIC, anon, authenticated/.test(grantSql) && !/GRANT EXECUTE[^;]*authenticated/.test(grantSql))
test("client fee preview matches DB rounding (ceil bps, atomic scale 1e7)", /Math\.ceil\(\(grossAtomic \* 300\) \/ 10_000\)/.test(sheet) && /ceil_fee_bps_floor_net/.test(quoteSql) && /PI_SCALE = 10_000_000/.test(sheet))
test("phase 28 checks registered in prebuild and verify:static", ["prebuild", "verify:static"].every((k) => (pkg.scripts[k] || "").includes("check-phase28-wallet-consent-flow.mjs") && (pkg.scripts[k] || "").includes("test-phase28-wallet-consent.mjs")))

const failed = results.filter((x) => !x).length
console.log(`\nPhase 28 wallet consent flow: ${results.length - failed}/${results.length} passed`)
process.exit(failed ? 1 : 0)
