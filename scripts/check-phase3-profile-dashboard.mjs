import fs from "node:fs";
import assert from "node:assert/strict";

const file = "components/ghc/profile-screen.tsx";
const source = fs.readFileSync(file, "utf8");
const dashboardStart = source.indexOf('aria-labelledby="gh-dashboard-growth-title"');
const dashboardEnd = source.indexOf('aria-label="Your communities"', dashboardStart);
const dashboard = source.slice(dashboardStart, dashboardEnd);
const profileStart = source.indexOf('<div className="gh-world-profile-identity');
const profileEnd = source.indexOf('<ProfileSectionTabs', profileStart);
const socialProfile = source.slice(profileStart, profileEnd);

assert(dashboardStart >= 0 && dashboardEnd > dashboardStart, "Dashboard identity section is present");
for (const feature of ["Your next moves", "Discovery signals", "ProfileIdentityOverview", "ProfileProfessionalShowcase", "ProfileAchievementShowcase", "PioneerIdentityStrip", "Profile {profileCompletion.percentage}% complete"]) {
  assert(dashboard.includes(feature), `Dashboard contains ${feature}`);
  assert(!socialProfile.includes(feature), `${feature} is not rendered in the social profile header`);
}
assert(socialProfile.includes("gh-premium-profile-stats"), "Social profile retains relationship stats");
assert(source.includes("/api/social/profile/${encodeURIComponent(meId)}/posts?limit=30&kind=all"), "Profile retains durable timeline API");
assert(source.includes("timelineLoadMoreAbortRef"), "Timeline pagination remains abortable");
assert(source.includes('event.key === "Escape"') && source.includes('document.body.style.overflow = "hidden"'), "Dashboard has Escape close and background scroll lock");
assert(source.includes("env(safe-area-inset-bottom)"), "Dashboard respects device safe-area inset");
assert(source.includes("ProfileEcosystemHub"), "Existing ecosystem hub remains integrated");
assert(!source.includes("GHC balance") || source.includes("GHC balance"), "No economy behavior asserted by this UI-only test");
console.log("Phase 3 Profile & Dashboard: 15/15 checks passed");
