#!/usr/bin/env node
import fs from 'node:fs'
const read = (p) => fs.readFileSync(p, 'utf8')
const registry = read('lib/navigation/service-registry.ts')
const screen = read('components/ghc/services-directory-screen.tsx')
const ecosystem = read('components/ghc/greenhaven-ecosystem-screen.tsx')
const listingsRoute = read('app/api/marketplace/listings/route.ts')
const marketplace = read('components/ghc/marketplace-screen.tsx')
const checks = [
  ['Services remains Coming Soon with no live destination', /id: "services-ip"[\s\S]{0,220}status: "COMING_SOON"[\s\S]{0,120}destination: \{ kind: "none" \}/.test(registry)],
  ['Services directory queries only service listings from canonical Marketplace API', /kind: "service"/.test(screen) && /\/api\/marketplace\/listings/.test(screen)],
  ['directory requires durable server-backed listing results', /payload\.durable !== true/.test(screen)],
  ['directory filters active service listing payloads and supported currencies', /row\.kind !== "service" \|\| row\.status !== "active"/.test(read('lib/ecosystem/services-directory.ts')) && /currency !== "GHC" && currency !== "PI"/.test(read('lib/ecosystem/services-directory.ts'))],
  ['service details hand off to existing canonical Marketplace listing detail', /onOpenMarketplace\(listingId\)/.test(screen) && /ghc:open-listing/.test(screen)],
  ['Marketplace API supports service kind and server-side active listing query', /\["product", "service", "opportunity"\]/.test(listingsRoute) && /kind: rawKind \? rawKind as "product" \| "service" \| "opportunity"/.test(listingsRoute)],
  ['Marketplace already includes seller command center and service listing support', /function SellerCommandCenter/.test(marketplace) && /kind === "service"/.test(marketplace)],
  ['Services screen is prepared but not wired into the Coming Soon directory', /ServicesDirectoryScreen/.test(screen) && !/ServicesDirectoryScreen/.test(ecosystem)],
  ['directory does not fabricate listings or trigger checkout/payment', !/localStorage|checkout|paymentIntent|createOrder/i.test(screen)],
  ['no new Services database migration is introduced in this increment', !fs.readdirSync('supabase/migrations').some((name) => /ecosystem_services|service_directory/i.test(name))],
]
let failed = 0
for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) failed++ }
console.log(`Services release-boundary checks: ${checks.length - failed}/${checks.length} passed`)
process.exit(failed ? 1 : 0)
