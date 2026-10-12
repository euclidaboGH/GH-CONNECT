import { readFileSync, existsSync } from "fs"
import { join } from "path"
const root = process.cwd()
const fails = []
const read = (r) => {
  const p = join(root, r)
  if (!existsSync(p)) { fails.push("missing "+r); return "" }
  return readFileSync(p, "utf8")
}
const store = read("lib/server/identity/profile-store.ts")
if (!store.includes("clipMediaRef")) fails.push("clipMediaRef required")
if (store.includes("clipStr(input.coverPhoto ?? input.cover_photo, 2000)")) fails.push("cover still clipped to 2000")
if (!existsSync(join(root, "lib/profile-media.ts"))) fails.push("missing profile-media")
if (!existsSync(join(root, "lib/profile-photo-cache.ts"))) fails.push("missing photo cache")
const screen = read("components/ghc/profile-screen.tsx")
if (!screen.includes("prepareProfilePhoto")) fails.push("profile screen must use prepareProfilePhoto")
const ctx = read("contexts/ghc-context.tsx")
if (!ctx.includes("saveProfileMediaCache")) fails.push("context must cache media")
if (!ctx.includes("mergeProfileMedia")) fails.push("context must merge media on hydrate")
if (fails.length) { console.error(fails); process.exit(1) }
console.log("test-profile-media-persist-static: PASS")
