#!/usr/bin/env node
/** Run #302: Pi withdrawal authorization and failure-diagnostic regression gate. */
import { readFileSync } from 'node:fs'
const read = (p) => readFileSync(p, 'utf8')
const consent = read('lib/server/identity/wallet-consent.ts')
const store = read('lib/server/identity/wallet-authorization.ts')
const route = read('app/api/identity/wallet-authorization/route.ts')
const client = read('lib/client/pi-wallet-consent.ts')
const card = read('components/ghc/pi-payout-authorization-card.tsx')
const checks = []
const test = (name, ok) => { checks.push(Boolean(ok)); console.log(`${ok ? 'PASS' : 'FAIL'} Run #302: ${name}`) }

test('wallet address is sourced only from the verified Pi Platform response', /const piWalletAddress = platformWalletAddress/.test(consent) && !/platformWalletAddress \|\| sdkWalletAddress/.test(consent))
test('browser SDK address is comparison-only and cannot be persisted as proof', /untrusted request data/.test(consent) && /platformWalletAddress !== sdkWalletAddress/.test(consent))
test('missing and browser-only unverified addresses have distinct errors', /PI_WALLET_ADDRESS_REQUIRED/.test(consent) && /PI_WALLET_ADDRESS_UNVERIFIED/.test(consent))
test('Pi UID is trimmed and bounded before identity mapping', /verifiedPiUid/.test(consent) && /verifiedPiUid\.length > 160/.test(consent))
test('forward mapping must belong to the authenticated GreenHaven user', /mapping\.ghUserId !== ghUserId/.test(consent))
test('reverse mapping must match both GreenHaven user and Pi UID', /reverse\.ghUserId !== ghUserId \|\| reverse\.piAppUid !== verifiedPiUid/.test(consent))
test('durable identity mapping is checked before wallet address acceptance', consent.indexOf('deps.getByGhUserId') < consent.indexOf('if (!platformWalletAddress)'))
test('wallet public-key format is validated server-side', /\^G\[A-Z2-7\]\{55\}\$/.test(consent))
test('grant service accepts only Platform API provenance', /walletAddressSource: "platform_api"/.test(store) && /input\.walletAddressSource !== "platform_api"/.test(store))
test('grant inputs are bounded and validated before privileged RPC', /userId\.length > 160/.test(store) && /piUid\.length > 160/.test(store) && /PI_WALLET_ADDRESS_UNVERIFIED/.test(store))
test('grant RPC response must echo the exact UID, address and source', /GRANT_RESPONSE_MISMATCH/.test(store) && /result\.value\.piAppUid !== piUid/.test(store) && /result\.value\.walletAddressSource !== "platform_api"/.test(store))
test('status active state requires a valid address, Platform source and verified timestamp', /trustedAddress/.test(store) && /const source = value\.walletAddressSource === "platform_api" \|\| value\.walletAddressSource === "provider_payment"/.test(store) && /Boolean\(verifiedAt\)/.test(store))
test('legacy status exposes a reason without exposing an untrusted wallet address', /authorizationReason/.test(store) && /piWalletAddress: uidMatches && trustedAddress \? address : null/.test(store))
test('payout assertion independently enforces Platform provenance and verification time', /provider_payment/.test(store) && /!verifiedAt/.test(store))
test('GET authorization endpoint propagates store failure rather than returning success', /if \(!status\.ok\) return reply/.test(route))
test('grant endpoint preserves only allowlisted safe RPC business errors', /knownGrantErrors/.test(route) && /diagnosticCode: publicError/.test(route))
test('grant failure logs include stage and correlation ID but not token/address', /stage: "GRANT_RPC"/.test(route) && /requestId: requestId/.test(route) && !/accessToken|piWalletAddress/.test((route.match(/console\.error\(\"\[wallet-authorization\] grant failed\", \{[\s\S]*?\}\)/) || [''])[0]))
test('read-back requires Platform source and verified timestamp', /verified\.walletAddressSource !== "platform_api"/.test(route) && /!verified\.walletAddressVerifiedAt/.test(route))
test('read-back failures retain a safe diagnostic code and request correlation', /stage: "READ_BACK"/.test(route) && /diagnosticCode/.test(route.slice(route.indexOf('independent read-back failed'))) && /knownReadbackErrors/.test(route))
test('provider-confirmed address remains trusted after an exact Pi PaymentDTO destination check', /provider_payment/.test(store) && /gh_pi_wallet_authorization_confirm_provider_address/.test(read('supabase/migrations/20261110125500_pi_wallet_address_binding_and_verified_a2u_diagnostics.sql')))
test('authorization card reuses the canonical timed status reader', /fetchWalletAuthorizationStatus/.test(card) && !/fetch\(\"\/api\/identity\/wallet-authorization/.test(card.slice(card.indexOf('const refresh'), card.indexOf('const grant'))))
test('client authorization is single-flight across mounted components', /consentInFlight/.test(client) && /if \(consentInFlight\) return consentInFlight/.test(client))
test('client status and grant requests have finite timeouts', /AbortSignal\.timeout\(12_000\)/.test(client) && /AbortSignal\.timeout\(15_000\)/.test(client))
test('client error normalization rejects inherited object properties', /Object\.hasOwn\(MESSAGES, c\)/.test(client))
test('client active state requires server-verified provenance and a verified timestamp', /body\.walletAddressSource === "platform_api" \|\| body\.walletAddressSource === "provider_payment"/.test(client) && /body\.walletAddressVerifiedAt/.test(client))
test('legacy authorization UI explains re-consent and Developer Portal permission', /previous Pi consent does not contain a wallet address verified by Pi's Platform API/.test(card) && /wallet_address permission/.test(card))
test('wallet consent error copy never recommends manually entering a payout address', !/enter or substitute an address manually/i.test(consent + client))

const failed = checks.filter((x) => !x).length
console.log(`\nRun #302 Pi withdrawal hardening: ${checks.length - failed}/${checks.length} passed; ${failed} failed.`)
if (failed) process.exit(1)
