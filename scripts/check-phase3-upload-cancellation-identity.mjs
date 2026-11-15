import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8")
const client = read("../lib/media/upload-client.ts")
const compose = read("../components/ghc/unified-compose.tsx")
const checks = [
  ["upload client accepts abort signal and captured identity", client.includes("signal?: AbortSignal") && client.includes("expectedUserId?: string")],
  ["proxy upload is abortable", client.includes('fetchWithPiSessionRecovery("/api/media"') && client.includes("signal: meta?.signal")],
  ["direct upload intent and finalization are abortable", client.includes('fetchWithPiSessionRecovery("/api/media/direct-upload-intent"') && client.includes('fetchWithPiSessionRecovery("/api/media/direct-upload-complete"')],
  ["signed storage PUT and fallback POST are abortable", client.includes('method: "PUT"') && client.includes('method: "POST"') && client.includes("signal: meta?.signal")],
  ["identity is checked before upload and before finalization", client.includes('error: "AUTH_CONTEXT_CHANGED"') && client.includes('IdentityService.getCurrentUserId() !== meta.expectedUserId')],
  ["Pi session recovery is blocked after identity changes", client.includes("identityAtStart") && client.includes("init.signal?.aborted || IdentityService.getCurrentUserId() !== identityAtStart")],
  ["abort is reported separately from network failure", client.includes('error: "UPLOAD_CANCELLED"')],
  ["composer aborts upload when account changes", compose.includes("activeUploadControllerRef.current?.abort()") && compose.includes("IdentityService.subscribe((identity)")],
  ["composer aborts pending upload on close", compose.includes("const close = (options: { saveDraft?: boolean } = {}) => {\n    activeUploadControllerRef.current?.abort()")],
  ["composer passes captured owner and signal for image, video and document", (compose.match(/expectedUserId,/g) || []).length >= 4 && (compose.match(/signal: controller\.signal/g) || []).length >= 4],
  ["image compression and video inspection stop before upload after account change", compose.includes("compressImageFile(file, { purpose: \"feed\", preferWebp: true })") && compose.includes("controller.signal.aborted || IdentityService.getCurrentUserId() !== expectedUserId")],
  ["offline story fallback cannot reattach after identity change", compose.includes("if (generation !== composeGenerationRef.current || controller.signal.aborted || IdentityService.getCurrentUserId() !== expectedUserId) return\n          const offline")],
]
let failed = 0
for (const [name, ok] of checks) { console.log(`${ok ? "PASS" : "FAIL"} ${name}`); if (!ok) failed += 1 }
console.log(`Phase 3 upload cancellation and identity guard: ${checks.length - failed}/${checks.length} checks passed`)
assert.equal(failed, 0)
