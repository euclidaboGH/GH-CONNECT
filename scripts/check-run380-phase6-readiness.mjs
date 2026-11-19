#!/usr/bin/env node
import { readFileSync } from 'node:fs'
const read = (p) => readFileSync(p, 'utf8')
const testnet = read('docs/PHASE6-TESTNET-READINESS-2026-11-19.md')
const mainnet = read('docs/PHASE6-MAINNET-READINESS-2026-11-19.md')
const pkg = JSON.parse(read('package.json'))
const checks = []
const check = (label, ok) => { checks.push(Boolean(ok)); console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`) }
check('01 Testnet readiness report is separate and blocks certification', /Testnet readiness report/.test(testnet) && /NOT CERTIFIED/.test(testnet))
check('02 Mainnet readiness report is separate and blocks production approval', /Mainnet readiness report/.test(mainnet) && /NOT APPROVED/.test(mainnet))
check('03 Testnet report records the 22-entry dependency audit blocker', /22 vulnerable dependency entries/.test(testnet) && /1 critical, 13 high, 6 moderate and 2 low/.test(testnet))
check('04 Testnet report requires Node 24.15.0 typecheck, lint and build', /Node 24\.15\.0/.test(testnet) && /typecheck/.test(testnet) && /production build/.test(testnet))
check('05 Testnet report requires real two-account authenticated acceptance', /two real Testnet accounts/.test(testnet) && /test:e2e:phase4/.test(testnet))
check('06 Testnet report keeps financial SQL proposals unapplied and gated', /proposals remain review-only and unapplied/.test(testnet) && /financial feature flags off/.test(testnet))
check('07 Mainnet report requires independent schema, migration, RLS and ACL review', /Mainnet schema, migration history/.test(mainnet) && /RLS/.test(mainnet) && /SECURITY DEFINER/.test(mainnet))
check('08 Mainnet report requires separate Pi app, provider and Production environment verification', /Pi Developer Portal app/.test(mainnet) && /Vercel Production env/.test(mainnet))
check('09 both reports prohibit unapproved database, payment and deployment actions', /No deployment or live database mutation is authorized/.test(testnet) && /No Mainnet migration, ACL change, ledger entry, payment/.test(mainnet))
check('10 current package version and source truth are synchronized', Boolean(pkg.version) && read('docs/PROJECT_TRUTH.md').includes(`Current source version:** \`${pkg.version}\``) && read('docs/SOURCE_OF_TRUTH.md').includes(`Current source version:** \`${pkg.version}\``))
check('11 Phase 4 acceptance refuses Production and requires Testnet env guards', /isProdTarget/.test(read('e2e/phase4-product-acceptance.spec.ts')) && /PI_NETWORK !== "testnet"/.test(read('e2e/phase4-product-acceptance.spec.ts')) && /NEXT_PUBLIC_PI_SANDBOX !== "true"/.test(read('e2e/phase4-product-acceptance.spec.ts')))
check('12 release decision remains no-go in both environments', /Decision: NOT CERTIFIED/.test(testnet) && /Decision: NOT APPROVED/.test(mainnet))
console.log(`\nRUN380 Phase 6 separate readiness reports: ${checks.filter(Boolean).length}/${checks.length}`)
if (checks.some(ok => !ok)) process.exit(1)
