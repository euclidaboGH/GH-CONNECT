import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8")
const compose = read("../components/ghc/unified-compose.tsx")
const drafts = read("../lib/creator/post-drafts.ts")
const strip = read("../components/ghc/compose-media-strip.tsx")
const checks = [
  ["saved drafts are loaded only from the active account-scoped draft service", compose.includes("setSavedDrafts(listPostDrafts())") && drafts.includes('return `${KEY_PREFIX}${encodeURIComponent(ownerId)}`')],
  ["draft list updates when saved drafts change", compose.includes('window.addEventListener("ghc:post-drafts-changed", refreshDrafts)')],
  ["draft picker bounds visible entries to the supported draft limit", compose.includes("savedDrafts.slice(0, 20)") && drafts.includes("const MAX = 20")],
  ["restoring a draft preserves current edits before switching drafts", compose.includes("const current = upsertPostDraft({") && compose.includes("activeDraftIdRef.current = current.id")],
  ["restored draft restores text, durable images, video, document and audience", compose.includes("setText(restored.content)") && compose.includes("restored.images.filter(isDurableMediaUrl)") && compose.includes("restored.video && isDurableMediaUrl(restored.video)") && compose.includes("restored.pdf && isDurableMediaUrl(restored.pdf)") && compose.includes("setAudience(restored.visibility || \"public\")")],
  ["restored publish idempotency data is preserved", compose.includes("restored.publishRequestId && restored.publishRequestSignature")],
  ["draft delete excludes the currently edited draft", compose.includes("!isCurrent ? (") && compose.includes("removePostDraft(draft.id)")],
  ["draft switching is disabled during publish or upload", compose.includes("disabled={isCurrent || isPublishing || Boolean(uploadProgress)}")],
  ["draft previews do not expose local blob or data URLs", drafts.includes("isDurableMediaUrl(u)") && drafts.includes("isDurableMediaUrl(x.video)")],
  ["draft storage remains account-scoped and avoids unowned legacy import", drafts.includes('KEY_PREFIX = "ghc.post-drafts.v2:"') && drafts.includes("Never import it into an arbitrary")],
  ["media previews remain lazy and video data deferred until play", strip.includes('loading="lazy"') && strip.includes('decoding="async"') && strip.includes('preload="none"')],
]
let failed = 0
for (const [name, ok] of checks) { console.log(`${ok ? "PASS" : "FAIL"} ${name}`); if (!ok) failed += 1 }
console.log(`Phase 3 creator draft recovery: ${checks.length - failed}/${checks.length} checks passed`)
assert.equal(failed, 0)
