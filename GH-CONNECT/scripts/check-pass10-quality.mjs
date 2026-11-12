import fs from "node:fs"
import path from "node:path"
const root = process.cwd()
const required = [
  "lib/privacy-health.ts",
  "lib/privacy-controls.ts",
  "lib/accessibility.ts",
  "lib/mobile-performance.ts",
  "components/ghc/settings.tsx",
]
for (const file of required) if (!fs.existsSync(path.join(root,file))) throw new Error(`Missing ${file}`)
const release = fs.readFileSync(path.join(root,"lib/app-release.ts"),"utf8")
const pkg = JSON.parse(fs.readFileSync(path.join(root,"package.json"),"utf8"))
if (!release.includes(`APP_RELEASE_VERSION = "${pkg.version}"`)) throw new Error("Release version mismatch")
const settings = fs.readFileSync(path.join(root,"components/ghc/settings.tsx"),"utf8")
for (const token of ["Privacy posture","getPrivacyHealth","min-h-11"]) if (!settings.includes(token)) throw new Error(`Missing quality control: ${token}`)
const a11y = fs.readFileSync(path.join(root,"lib/accessibility.ts"),"utf8")
for (const token of ["touchTargetClass","captureFocus","prefersReducedMotion"]) if (!a11y.includes(token)) throw new Error(`Missing accessibility helper: ${token}`)
const mobile = fs.readFileSync(path.join(root,"lib/mobile-performance.ts"),"utf8")
for (const token of ["getDevicePerformanceProfile","preferReducedData","scheduleNonCriticalWork"]) if (!mobile.includes(token)) throw new Error(`Missing mobile helper: ${token}`)
console.log("PASS 10/10: privacy posture, accessibility helpers, mobile resilience, settings integration, release metadata")
