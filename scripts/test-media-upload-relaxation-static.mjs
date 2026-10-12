import { readFileSync, existsSync } from "fs"
import { join } from "path"
const root = process.cwd()
const fails = []
const read = (r) => {
  const p = join(root, r)
  if (!existsSync(p)) { fails.push("missing "+r); return "" }
  return readFileSync(p, "utf8")
}
const v = read("lib/media-validation.ts")
if (!v.includes("MAX_VIDEO_BYTES = 100")) fails.push("video limit should be 100MB")
if (!v.includes("MAX_IMAGE_BYTES = 50")) fails.push("image limit should be 50MB")
if (!v.includes("validateMediaFileSoft")) fails.push("soft validate required")
if (!v.includes("heic")) fails.push("heic support required")
if (!v.includes("normalizeMediaMime")) fails.push("mime normalize required")

const api = read("app/api/media/route.ts")
if (!api.includes("100 * 1024 * 1024")) fails.push("API video limit 100MB")
if (!api.includes("50 * 1024 * 1024")) fails.push("API image limit 50MB")

const c = read("lib/media/compress-image.ts")
if (!c.includes("50 * 1024 * 1024")) fails.push("compress max input 50MB")

const uc = read("components/ghc/unified-compose.tsx")
if (!uc.includes("validateMediaFileSoft")) fails.push("compose should soft-validate video")

if (fails.length) {
  console.error("FAIL", fails)
  process.exit(1)
}
console.log("test-media-upload-relaxation-static: PASS")
