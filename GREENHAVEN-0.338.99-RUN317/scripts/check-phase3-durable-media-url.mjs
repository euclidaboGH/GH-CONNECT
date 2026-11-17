import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8")
const policy = read("../lib/media/durable-url.ts")
const drafts = read("../lib/creator/post-drafts.ts")
const compose = read("../components/ghc/unified-compose.tsx")
const checks = [
  ["durable media uses an explicit scheme allowlist", policy.includes("javascript|vbscript|file|filesystem") && policy.includes('parsed.protocol === "https:"')],
  ["protocol-relative external URLs are rejected", policy.includes('!value.startsWith("//")')],
  ["credential-bearing URLs are rejected", policy.includes("parsed.username || parsed.password")],
  ["plain HTTP is restricted to loopback development", policy.includes('parsed.protocol === "http:"') && policy.includes('host === "localhost"')],
  ["draft image/video/document references use canonical media policy", drafts.includes("isDurableMediaUrl(u)") && drafts.includes("isDurableMediaUrl(x.video)") && drafts.includes("isDurableMediaUrl(x.pdf)")],
  ["feed composer does not attach local data URLs as post media", compose.includes("Photo was not attached because server storage is unavailable") && !compose.includes("images.push(dataUrl)")],
  ["story publish fails closed for non-durable local media", compose.includes("storyMedia?.url && !isDurableMediaUrl(storyMedia.url)")],
]
let failed = 0
for (const [label, ok] of checks) { console.log(`${ok ? "PASS" : "FAIL"} ${label}`); if (!ok) failed++ }
console.log(`Phase 3 durable media hardening: ${checks.length - failed}/${checks.length} checks passed`)
assert.equal(failed, 0)
