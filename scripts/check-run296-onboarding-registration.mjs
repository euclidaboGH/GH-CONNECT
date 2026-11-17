import fs from "node:fs"
import assert from "node:assert/strict"

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
const onboarding = read("components/ghc/onboarding.tsx")
const context = read("contexts/ghc-context.tsx")
const profileStore = read("lib/server/identity/profile-store.ts")
const completionRoute = read("app/api/auth/onboarding-complete/route.ts")
const ageUtils = read("lib/age-utils.ts")

assert.match(onboarding, /age:\s*typeof safeProfile\.age === "number" \? safeProfile\.age : 0/)
assert.match(onboarding, /type="date"\s+required/)
assert.match(onboarding, /Enter your date of birth to continue/)
assert.match(onboarding, /if \(step === 2\)[\s\S]*Choose at least one connection goal/)
assert.match(onboarding, /Choose at least 3 interests/)
assert.match(onboarding, /Add a profile photo to continue/)
assert.match(onboarding, /uploadDurableMedia\(blob/)
assert.match(onboarding, /if \(!saved\)/)
assert.match(context, /updateProfile: \(updates: Partial<Profile>\) => Promise<boolean>/)
assert.match(context, /serverRejectedIncompleteProfile/)
assert.match(context, /return false/)
assert.match(profileStore, /export function getOnboardingProfileGaps/)
for (const field of ["displayName", "age", "gender", "city", "country", "primaryMode", "connectionIntents", "interests", "photos"]) {
  assert.ok(profileStore.includes(`gaps.push("${field}")`), `server completion gate must validate ${field}`)
}
assert.match(profileStore, /if \(isProd\(\)\) return null/)
assert.match(profileStore, /age: rec\.age,/)
assert.match(completionRoute, /ONBOARDING_PROFILE_INCOMPLETE/)
assert.match(completionRoute, /status: 422/)
assert.match(ageUtils, /birth\.getFullYear\(\) !== y/)

console.log("RUN296 onboarding registration integrity: PASS (18 contract assertions)")
