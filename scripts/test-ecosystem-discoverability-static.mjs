import { readFileSync, existsSync } from "fs"
import { join } from "path"
const root = process.cwd()
const fails = []
const read = (r) => {
  const p = join(root, r)
  if (!existsSync(p)) { fails.push("missing "+r); return "" }
  return readFileSync(p, "utf8")
}
if (!existsSync(join(root, "components/ghc/ecosystem-quick-access.tsx"))) fails.push("missing quick access component")
const feed = read("components/ghc/enhanced-feed-screen.tsx")
if (!feed.includes('navigateTo("marketplace")')) fails.push("feed marketplace entry")
if (!feed.includes("<EcosystemQuickAccess")) fails.push("feed quick access card")
const more = read("components/ghc/profile-more-nav.tsx")
if (!more.includes('navigateTo("marketplace")')) fails.push("profile more marketplace")
if (!more.includes('navigateTo("ecosystem")')) fails.push("profile more ecosystem")
const hub = read("components/ghc/profile-ecosystem-hub.tsx")
if (!hub.includes('navigateTo("marketplace")')) fails.push("hub marketplace")
if (fails.length) { console.error(fails); process.exit(1) }
console.log("test-ecosystem-discoverability-static: PASS")
