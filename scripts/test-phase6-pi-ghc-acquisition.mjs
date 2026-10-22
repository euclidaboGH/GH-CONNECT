import assert from "node:assert/strict"
import { readFileSync, existsSync } from "node:fs"
const read = (p) => readFileSync(p, "utf8")
const catalogPath = "lib/server/monetization/pi-acquisition-proposal.ts"
const routePath = "app/api/economy/pi-acquisition-policy/route.ts"
assert.ok(existsSync(catalogPath), "server-owned proposal exists")
assert.ok(existsSync(routePath), "read-only proposal endpoint exists")
const catalog = read(catalogPath)
const route = read(routePath)
const pkg = JSON.parse(read("package.json"))
const lock = JSON.parse(read("package-lock.json"))
const release = read("lib/app-release.ts")
for (const invariant of ["piCheckoutEnabled: false", "durableGhcCreditEnabled: false", "automaticConversionEnabled: false", "piPrice: null", "ghcAmount: null", "purchasable: false", "provider/server verification", "Pi Platform policy", "reconciliation"]) {
  assert.ok(catalog.includes(invariant), `proposal enforces ${invariant}`)
}
for (const id of ["ghc_starter", "ghc_growth", "ghc_community"]) assert.ok(catalog.includes(id), `proposal pack ${id} exists`)
assert.match(route, /export async function GET\(\)/, "endpoint is read-only GET")
assert.match(route, /getPiGhcAcquisitionProposal\(\)/, "endpoint uses server-owned proposal")
assert.match(route, /Cache-Control.*public, max-age=60/, "public cache is bounded")
assert.ok(/^\d+\.\d+\.\d+/.test(pkg.version), "package version is a valid semver release")
assert.equal(lock.version, pkg.version, "lockfile version matches")
assert.equal(lock.packages[""].version, pkg.version, "lockfile root package version matches")
assert.ok(release.includes(`APP_RELEASE_VERSION = "${pkg.version}"`), "release metadata matches package")
assert.match(pkg.scripts["ci:verify"], /test:phase6-pi-ghc-acquisition/, "gate is part of ci:verify")
console.log("Phase 6 Pi-funded GHC acquisition proposal: 20 assertions passed")
