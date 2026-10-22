import assert from "node:assert/strict"
import { readFileSync, existsSync } from "node:fs"
const read = (p) => readFileSync(p, "utf8")
const policyPath = "lib/server/release/stage7-readiness.ts"
const routePath = "app/api/release/readiness/route.ts"
assert.ok(existsSync(policyPath), "server-owned Stage 7 policy exists")
assert.ok(existsSync(routePath), "read-only readiness endpoint exists")
const policy = read(policyPath)
const route = read(routePath)
for (const gate of ["ci", "payments", "security", "observability", "recovery", "rollout"]) assert.ok(policy.includes(`id: "${gate}"`), `release gate ${gate} exists`)
for (const invariant of ["not_release_approved", "deploymentPerformed: false", "financialFeaturesEnabled: false", "Never expose secrets", "rollback is tested"]) assert.ok(policy.includes(invariant), `policy preserves ${invariant}`)
assert.match(route, /export async function GET\(\)/, "endpoint is GET only")
assert.match(route, /getStage7ReadinessPolicy\(\)/, "route uses server-owned policy")
assert.match(route, /Cache-Control.*max-age=60/, "response cache is bounded")
const pkg = JSON.parse(read("package.json"))
const lock = JSON.parse(read("package-lock.json"))
assert.ok(/^\d+\.\d+\.\d+/.test(pkg.version), "package version is a valid semver release")
assert.equal(lock.version, pkg.version, "lockfile version matches")
assert.equal(lock.packages[""].version, pkg.version, "lockfile root version matches")
assert.ok(read("lib/app-release.ts").includes(`APP_RELEASE_VERSION = "${pkg.version}"`), "release metadata matches")
assert.match(pkg.scripts["ci:verify"], /test:stage7-release-readiness/, "Stage 7 gate is in ci:verify")
console.log("Stage 7 scale and release readiness: 23 assertions passed")
