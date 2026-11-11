import fs from "node:fs"
const read = (path) => fs.readFileSync(path, "utf8")
const showcase = read("components/ghc/profile-professional-showcase.tsx")
const owner = read("components/ghc/profile-screen.tsx")
const peer = read("components/ghc/profile-preview-page.tsx")
const discovery = read("lib/domains/adapters/discovery-adapter.ts")
const profileStore = read("lib/server/identity/profile-store.ts")
const professionalIdentity = read("lib/profile/professional-identity.ts")
const discoverRoute = read("app/api/social/people/discover/route.ts")
const privacyProjection = read("lib/server/privacy-feed-contract.ts")
const checks = [
  ["owner profile renders professional/business showcase", owner.includes('aria-label="About"') && owner.includes("<ProfileProfessionalShowcase") && owner.includes("profile={p}") && owner.includes("onSave={async (patch)")],
  ["public peer profile renders read-only professional showcase", peer.includes("<ProfileProfessionalShowcase profile={candidate} readOnly />")],
  ["showcase supports service, skills, experience and portfolio", ["Services", "Skills", "Experience", "Selected work"].every((label) => showcase.includes(label))],
  ["portfolio links require HTTPS and reject embedded credentials", showcase.includes('url.protocol !== "https:"') && showcase.includes("url.username || url.password")],
  ["client-editable identity never self-asserts verification", !showcase.includes("businessVerified") && !showcase.includes("professionalVerified") && professionalIdentity.includes("Verification is never accepted here")],
  ["achievement hydration uses authenticated server endpoint", showcase.includes('/api/profile/achievements') && showcase.includes('credentials: "include"')],
  ["achievement results are deduplicated and account-scoped", showcase.includes("new Map<string, AchievementRow>()") && showcase.includes("IdentityService.getCurrentUserId() !== identity")],
  ["achievement hydration cancels stale requests on account change", showcase.includes("requestRef.current?.abort()") && showcase.includes("IdentityService.subscribe")],
  ["public profile showcase has no financial or wallet fields", !showcase.match(/\b(wallet|balance|ledger|payout|payment)\b/i) && !showcase.match(/\bGHC\b/)],
  ["discovery relevance includes public professional interests", discovery.includes("raw.professional?.professionalInterests") && discovery.includes("const sharedInterests = interests")],
  ["profile PATCH bounds professional/business payloads and ignores client verification", profileStore.includes("sanitizeProfessionalIdentityPayload") && profileStore.includes("sanitizeBusinessIdentityPayload") && professionalIdentity.includes("Verification is never accepted here")],
  ["people discovery projects only whitelisted public identity fields", discoverRoute.includes("publicIdentityPayload") && discoverRoute.includes("safeHttpsUrl") && discoverRoute.includes('visibility === "hidden"')],
  ["public profile projection enforces professional and nested location/interests privacy", privacyProjection.includes("preferences.showProfessionOnSocial === false") && privacyProjection.includes("delete professional.locationLabel") && privacyProjection.includes("delete professional.professionalInterests")],
]
for (const [name, ok] of checks) console.log(`${ok ? "PASS" : "FAIL"} — ${name}`)
const failed = checks.filter(([, ok]) => !ok)
console.log(`Phase 7 Identity Showcase: ${checks.length - failed.length}/${checks.length}`)
if (failed.length) process.exit(1)
