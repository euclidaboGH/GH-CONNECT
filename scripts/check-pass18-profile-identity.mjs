import fs from "node:fs"
const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), "utf8")
const checks = []
const check = (name, ok) => { checks.push([name, Boolean(ok)]); console.log(`${ok ? "PASS" : "FAIL"} — ${name}`) }
const release = read("lib/app-release.ts")
const pkg = JSON.parse(read("package.json"))
const profile = read("components/ghc/profile-screen.tsx")
const identity = read("components/ghc/profile-identity-overview.tsx")
check("release metadata is 0.240.0", release.includes(`APP_RELEASE_VERSION = "${pkg.version}"`))
check("identity results use authoritative APIs", identity.includes('/api/social/follows') && identity.includes('/api/social/reputation') && identity.includes('/api/profile/achievements'))
check("identity exposes followers and following", identity.includes('Followers') && identity.includes('Following'))
check("reputation progress is visible", identity.includes('Reputation progress') && identity.includes('snapshot.progress'))
check("profile provides results-oriented next action", identity.includes('outcomeFor') && identity.includes('Build your network') && identity.includes('Turn participation into proof'))
check("offline profile copy makes no automatic sync promise", profile.includes('may need to be retried after you reconnect') && !profile.includes('sync when you reconnect'))
check("profile keeps canonical ecosystem actions", profile.includes('Messages') && profile.includes('Communities') && profile.includes('Marketplace') && profile.includes('Wallet'))
check("no invented verification in identity results", !identity.includes('verified: true') && !identity.includes('KYC'))
const failed = checks.filter(([, ok]) => !ok)
console.log(`\nPass 18 Profile Identity: ${checks.length - failed.length}/${checks.length} passed`)
if (failed.length) process.exit(1)
