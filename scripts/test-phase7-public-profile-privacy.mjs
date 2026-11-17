import assert from "node:assert/strict"
import { projectPublicProfile } from "../lib/server/privacy-feed-contract.ts"

const base = {
  profileMode: "professional",
  profession: "Product designer",
  skills: ["UX", "Research"],
  interests: ["Design"],
  city: "Port Harcourt",
  country: "Nigeria",
  professional: {
    title: "Product designer",
    professionalInterests: ["Accessibility"],
    locationLabel: "Port Harcourt",
    contactPreferences: { showProfessionOnSocial: false, allowInAppMessage: true },
    professionalVerified: true,
  },
  business: { businessName: "Studio", locationLabel: "Port Harcourt", businessVerified: true },
  wallet: { balance: 123 },
  ghcBalance: 123,
}

const hiddenProfession = projectPublicProfile(base, {
  isOwner: false, showActivity: true, showInterests: false, showCommunities: true,
  showLocation: false, onlineStatus: "everyone",
})
assert.equal(hiddenProfession.profileMode, "business")
assert.equal("profession" in hiddenProfession, false)
assert.equal("skills" in hiddenProfession, false)
assert.equal("professional" in hiddenProfession, false)
assert.equal("city" in hiddenProfession, false)
assert.equal("wallet" in hiddenProfession, false)
assert.equal("ghcBalance" in hiddenProfession, false)
assert.equal(hiddenProfession.business.locationLabel, undefined)
assert.equal("businessVerified" in hiddenProfession.business, false)


const visible = projectPublicProfile({ ...base, professional: { ...base.professional, contactPreferences: { showProfessionOnSocial: true } } }, {
  isOwner: false, showActivity: true, showInterests: false, showCommunities: true,
  showLocation: false, onlineStatus: "everyone",
})
assert.equal(visible.professional.title, "Product designer")
assert.equal(visible.professional.professionalInterests, undefined)
assert.equal(visible.professional.locationLabel, undefined)
assert.equal("contactPreferences" in visible.professional, false)
assert.equal("professionalVerified" in visible.professional, false)
console.log("Phase 7 public-profile privacy projection: PASS (16 assertions)")
