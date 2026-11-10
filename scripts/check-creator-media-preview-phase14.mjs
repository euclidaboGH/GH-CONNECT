#!/usr/bin/env node
import fs from "node:fs"
import assert from "node:assert/strict"

const read = (path) => fs.readFileSync(path, "utf8")
const strip = read("components/ghc/compose-media-strip.tsx")
const compose = read("components/ghc/unified-compose.tsx")
const video = read("components/ghc/durable-video.tsx")
const lightbox = read("components/ghc/media-lightbox.tsx")
const pkg = JSON.parse(read("package.json"))
const lock = JSON.parse(read("package-lock.json"))
const checks = [
  ["post composer image thumbnails open a full-screen gallery preview", strip.includes("setPreviewIndex(i)") && strip.includes("<MediaLightbox") && strip.includes("urls={images.map")],
  ["gallery preview opens at the selected image index", strip.includes("index={previewIndex ?? 0}")],
  ["image removal remains a separate accessible action", strip.includes("onRemoveImage(i)") && strip.includes("aria-label={`Remove photo ${i + 1}`}")],
  ["video attachments have an inline playback preview", strip.includes("Preview before publishing") && strip.includes("<DurableVideo") && strip.includes("controls playsInline")],
  ["private video facade references use the authorized durable video resolver", video.includes("resolveDisplayMediaUrl(raw)") && strip.includes("<DurableVideo src={video}")],
  ["story image previews preserve full image proportions and can open full screen", compose.includes("Preview story photo full screen") && compose.includes("object-contain") && compose.includes("storyPreviewOpen")],
  ["story video attachments have playback controls before publishing", compose.includes("Story video preview") && compose.includes("<DurableVideo src={storyMedia.url} controls")],
  ["full-screen previews reuse the shared accessible media viewer", strip.includes("<MediaLightbox") && compose.includes("<MediaLightbox") && lightbox.includes('role="dialog"') && lightbox.includes('aria-modal="true"')],
  ["preview UI remains separate from media upload and publish ownership", compose.includes("uploadDurableMedia") && compose.includes("createPost") && strip.includes("onRemoveImage")],
  ["release, lockfile and both quality gates are synchronized", pkg.version === lock.version && lock.version === pkg.version && lock.packages?.[""]?.version === pkg.version && read("lib/app-release.ts").includes(`APP_RELEASE_VERSION = "${pkg.version}"`) && pkg.scripts['prebuild:checks'].includes("check-creator-media-preview-phase14") && pkg.scripts["verify:static"].includes("check-creator-media-preview-phase14")],
]
for (const [name, passed] of checks) { assert.equal(passed, true, name); console.log(`PASS ${name}`) }
console.log(`Creator media preview Phase 14: ${checks.length}/${checks.length} passed`)
