import fs from "node:fs"
import assert from "node:assert/strict"

const read = (path) => fs.readFileSync(path, "utf8")
const css = read("app/globals.css")
const status = read("components/ghc/accessible-status.tsx")
const announcer = read("components/ghc/accessibility-announcer.tsx")
const app = read("components/ghc/app.tsx")
const shell = read("lib/i18n/shell.ts")
const governance = read("lib/i18n/review-governance.ts")
const i18n = read("lib/i18n/index.ts")
const pkg = JSON.parse(read("package.json"))
const checks = [
  ["shared accessible status primitive supports polite and assertive feedback", status.includes('politeness?: "polite" | "assertive" | "off"') && status.includes('role={politeness === "assertive" ? "alert" : "status"}')],
  ["suspense loading surfaces use shared busy status primitive", app.includes("<AccessibleStatus") && app.includes("label={`${loadingLabel} ${label}`}" ) && app.includes("      busy")],
  ["navigation announcements localise section-loaded feedback", announcer.includes('getShellMessage("sectionLoaded", locale)') && app.includes('locale={regional.locale}')],
  ["main landmark accessible name follows selected locale", app.includes('aria-label={getShellMessage("mainContent", regional.locale)}')],
  ["all four preview packs define main landmark and loaded announcement labels", ["Babban abun cikin GreenHaven", "Isi ọdịnaya GreenHaven", "Àkóónú pàtàkì GreenHaven", "section don load"].every((value) => shell.includes(value))],
  ["interactive controls meet 44px minimum target unless explicitly compact", css.includes("min-block-size: 2.75rem") && css.includes("[data-gh-compact-target]")],
  ["keyboard focus is consistently visible", css.includes(":focus-visible") && css.includes("outline-offset: 2px")],
  ["reduced-motion preference disables nonessential animation and smooth scrolling", css.includes("@media (prefers-reduced-motion: reduce)") && css.includes("animation-duration: 0.01ms") && css.includes("scroll-behavior: auto !important")],
  ["forced-colors mode preserves focus and invalid-field affordances", css.includes("@media (forced-colors: active)") && css.includes("border: 2px solid Mark")],
  ["error-summary styling uses logical direction and semantic invalid state", css.includes("[data-gh-error-summary]") && css.includes('[aria-invalid="true"]') && css.includes("border-inline-start")],
  ["catalog version 7 requires fresh native and owner review", governance.includes('currentCatalogVersion: "7"') && i18n.includes('TRANSLATION_CATALOG_VERSION = "7"')],
  ["accessibility regression gate is in prebuild and static verification", pkg.scripts["check:global-accessibility-phase10"] && pkg.scripts['prebuild:checks'].includes("check-global-accessibility-phase10") && pkg.scripts["verify:static"].includes("check-global-accessibility-phase10")],
]
for (const [name, passed] of checks) { assert.equal(passed, true, name); console.log(`PASS ${name}`) }
console.log(`Global accessibility Phase 10: ${checks.length}/${checks.length} passed`)
