/**
 * Section D static gates — security & abuse controls.
 */
import { readFileSync, existsSync } from "fs"
import { join } from "path"

const root = process.cwd()
const fails = []
const read = (rel) => {
  const p = join(root, rel)
  if (!existsSync(p)) {
    fails.push(`missing ${rel}`)
    return ""
  }
  return readFileSync(p, "utf8")
}

if (!existsSync(join(root, "scripts/test-idor-static.mjs"))) {
  fails.push("test-idor-static.mjs required")
}
if (!existsSync(join(root, "scripts/test-messaging-authz.mjs"))) {
  fails.push("messaging authz test script expected")
}

const vercel = read("vercel.json")
if (/X-Frame-Options/i.test(vercel) && /SAMEORIGIN/i.test(vercel)) {
  fails.push("X-Frame-Options SAMEORIGIN breaks Pi Browser iframe embedding")
}
if (!/frame-ancestors/i.test(vercel) || !/minepi\.com/i.test(vercel)) {
  fails.push("CSP frame-ancestors must allow Pi domains")
}

const media = read("app/api/media/route.ts")
if (!media.includes("MAX_IMAGE_BYTES") || !media.includes("ALLOWED_IMAGE")) {
  fails.push("media route must enforce MIME allowlist and size caps")
}

const reports = read("app/api/reports/route.ts")
if (!reports.includes("POST") || !reports.includes("reason")) {
  fails.push("reports intake route required")
}

if (!existsSync(join(root, "app/api/social/mutes/route.ts"))) {
  fails.push("social mutes route required")
}
if (!existsSync(join(root, "app/api/social/blocks/route.ts"))) {
  fails.push("social blocks route required")
}

if (fails.length) {
  console.error("test-security-cd-static FAILED")
  fails.forEach((f) => console.error(" -", f))
  process.exit(1)
}
console.log("test-security-cd-static: PASS")
