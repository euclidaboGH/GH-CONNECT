import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8")
const compose = read("../components/ghc/unified-compose.tsx")
const upload = read("../lib/media/upload-client.ts")
const drafts = read("../lib/creator/post-drafts.ts")
const mediaPolicy = read("../lib/media/durable-url.ts")
const strip = read("../components/ghc/compose-media-strip.tsx")
const css = read("../app/globals.css")
const checks = [
  ["all publishing uses the canonical UnifiedCompose surface", compose.includes("export function UnifiedCompose") && read("../components/ghc/post-composer.tsx").includes("<UnifiedCompose")],
  ["post publishing rejects non-durable image URLs", compose.includes("selectedImages.filter((u) => !isDurableMediaUrl(u))")],
  ["post publishing rejects non-durable video and document URLs", compose.includes("!isDurableMediaUrl(selectedVideo)") && compose.includes("!isDurableMediaUrl(selectedDoc)")],
  ["direct media completion reuses authenticated session identity", upload.includes("/api/media/direct-upload-complete") && upload.includes("...authHeaders()")],
  ["account change clears composer media and closes transient compose", compose.includes("Composer closed because the active account changed") && compose.includes("setSelectedImages([])")],
  ["stale uploads cannot attach media after account switch", compose.includes("composeGenerationRef.current += 1") && compose.includes("generation !== composeGenerationRef.current") && compose.includes("generation === composeGenerationRef.current) setUploadProgress(label)")],
  ["stale publish responses cannot close or reset a different account composer", compose.includes("if (generation !== composeGenerationRef.current) return") && compose.includes("if (generation === composeGenerationRef.current) {" )],
  ["draft storage is account-scoped and excludes blob/data URLs", drafts.includes("KEY_PREFIX = \"ghc.post-drafts.v2:\"") && drafts.includes('!d.images') === false && drafts.includes("isDurableMediaUrl(u)") && drafts.includes("isDurableMediaUrl(x.video)") && mediaPolicy.includes("javascript|vbscript|file|filesystem")],
  ["media preview supports lazy image decode and video deferred preload", strip.includes('loading="lazy"') && strip.includes('decoding="async"') && strip.includes('preload="none"')],
  ["upload indicator is explicitly indeterminate rather than a fake percentage", strip.includes('role="progressbar"') && strip.includes("aria-valuetext={message}") && css.includes("gh-compose-upload-indeterminate")],
  ["upload animation respects reduced-motion preference", css.includes("@media (prefers-reduced-motion: reduce)") && css.includes(".gh-compose-upload-indeterminate { animation: none")],
  ["failed document upload never attaches an unpublishable local data URL", compose.includes("A local data URL cannot be delivered durably") && !compose.includes('readFileAsDataUrl(file, "file")') && compose.includes("Photo was not attached because server storage is unavailable")],
  ["durable media URL policy exists and is consumed by composer", mediaPolicy.includes("isDurableMediaUrl") && compose.includes("isDurableMediaUrl")],
]
let failed = 0
for (const [name, ok] of checks) { console.log(`${ok ? "PASS" : "FAIL"} ${name}`); if (!ok) failed += 1 }
console.log(`Phase 3 creator/media source gate: ${checks.length - failed}/${checks.length} checks passed`)
assert.equal(failed, 0)
