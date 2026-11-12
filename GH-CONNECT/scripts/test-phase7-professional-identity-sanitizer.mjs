import assert from "node:assert/strict"
import { sanitizeBusinessIdentityPayload, sanitizeProfessionalIdentityPayload } from "../lib/profile/professional-identity.ts"

const professional = sanitizeProfessionalIdentityPayload({
  title: "  Senior Designer  ", about: "A\u0000 helpful designer", skills: ["UX", "UX", "Research", 4],
  professionalVerified: true, services: ["Design"],
  portfolio: [
    { title: "Safe", url: "https://portfolio.example/work", mediaUrl: "https://portfolio.example/cover.jpg", description: "Good" },
    { title: "Bad scheme", url: "javascript:alert(1)" },
    { title: "Credentials", url: "https://user:secret@example.com/" },
    { title: "HTTP", url: "http://example.com", mediaUrl: "javascript:alert(2)" },
  ],
  experience: [{ role: "Lead", organization: "Studio" }, { organization: "No role" }],
  contactPreferences: { allowInAppMessage: true, showProfessionOnSocial: false },
})
assert.equal(professional.title, "Senior Designer")
assert.equal(professional.about, "A helpful designer")
assert.deepEqual(professional.skills, ["UX", "Research"])
assert.equal("professionalVerified" in professional, false)
assert.equal(professional.portfolio.length, 4)
assert.equal(professional.portfolio[0].url, "https://portfolio.example/work")
assert.equal(professional.portfolio[0].mediaUrl, "https://portfolio.example/cover.jpg")
assert.equal(professional.portfolio[1].url, undefined)
assert.equal(professional.portfolio[2].url, undefined)
assert.equal(professional.portfolio[3].url, undefined)
assert.equal(professional.portfolio[3].mediaUrl, undefined)
assert.equal(professional.experience.length, 1)
assert.equal(professional.contactPreferences.showProfessionOnSocial, false)

const business = sanitizeBusinessIdentityPayload({
  businessName: "Green Studio", category: "Design", businessVerified: true,
  services: ["Branding", "Branding", "Web"], hours: "Mon-Fri",
})
assert.equal(business.businessName, "Green Studio")
assert.deepEqual(business.services, ["Branding", "Web"])
assert.equal("businessVerified" in business, false)
assert.equal(sanitizeProfessionalIdentityPayload({ title: "invalid" })?.title, "invalid")
assert.equal(sanitizeProfessionalIdentityPayload(null), null)
assert.equal(sanitizeBusinessIdentityPayload([]), null)
console.log("Phase 7 professional/business payload sanitizer: PASS (16 assertions)")
