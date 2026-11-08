import fs from "node:fs"
import path from "node:path"
const root = process.cwd()
const settings = fs.readFileSync(path.join(root, "components/ghc/settings.tsx"), "utf8")
const context = fs.readFileSync(path.join(root, "contexts/ghc-context.tsx"), "utf8")
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"))
const lock = JSON.parse(fs.readFileSync(path.join(root, "package-lock.json"), "utf8"))
const release = fs.readFileSync(path.join(root, "lib/app-release.ts"), "utf8")
const checks = [
  ["settings landing has coordinated control-centre overview", settings.includes("Your control centre") && settings.includes("overviewActions")],
  ["overview surfaces privacy posture", settings.includes("privacyHealth.label")],
  ["overview summarizes notification preferences", settings.includes("enabledNotificationCount")],
  ["overview exposes direct privacy navigation", /title: "Privacy & safety"[\s\S]*?goToSection\("privacy"\)/.test(settings)],
  ["overview exposes direct notification navigation", /title: "Notifications"[\s\S]*?goToSection\("notifications"\)/.test(settings)],
  ["overview exposes direct appearance navigation", /title: "Appearance"[\s\S]*?goToSection\("appearance"\)/.test(settings)],
  ["settings updates send narrow patches instead of stale full snapshots", /updateSettings\(\{ \[key\]: value \}/.test(settings) && !/updateSettings\(\{ \.\.\.settings, \[key\]: value/.test(settings)],
  ["theme changes use narrow settings patches", /updateSettings\(\{\s*themeMode: mode/.test(settings) && /updateSettings\(\{\s*themeId: id/.test(settings)],
  ["custom theme upload avoids overwriting unrelated settings", /themeCustomImage: dataUrl,\s*themeId: settings\.themeId/.test(settings)],
  ["discovery radius is bounded", /Math\.min\(100, Math\.max\(1, Math\.round\(value\)\)\)/.test(settings)],
  ["minimum age cannot exceed configured maximum", /key === "ageMin"[\s\S]*?Math\.min\(Math\.round\(value\), Number\(settings\.ageMax\)/.test(settings)],
  ["maximum age cannot fall below configured minimum", /key === "ageMax"[\s\S]*?Math\.max\(Math\.round\(value\), Number\(settings\.ageMin\)/.test(settings)],
  ["server-backed messaging privacy contract remains intact", context.includes("/api/messaging/preferences") && context.includes("Messaging privacy could not be saved securely")],
  ["settings continue using delayed SDK persistence", context.includes("STORAGE_KEYS.settings, settings") && context.includes("}, 1500)")],
  ["release package and lock synchronized", pkg.version === lock.version && lock.packages?.[""]?.version === pkg.version],
  ["release metadata synchronized", release.includes(`APP_RELEASE_VERSION = "${pkg.version}"`)],
]
let failed = 0
for (const [label, ok] of checks) { console.log(`${ok ? "PASS" : "FAIL"} — ${label}`); if (!ok) failed++ }
console.log(`Priority 6 Settings gate: ${checks.length - failed}/${checks.length}`)
if (failed) process.exit(1)
