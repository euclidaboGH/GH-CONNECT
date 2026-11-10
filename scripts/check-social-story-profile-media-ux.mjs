#!/usr/bin/env node
import fs from 'node:fs'
import assert from 'node:assert/strict'

const read = (path) => fs.readFileSync(path, 'utf8')
const story = read('components/ghc/profile-story-section.tsx')
const profile = read('components/ghc/profile-screen.tsx')
const lightbox = read('components/ghc/media-lightbox.tsx')
const pkg = JSON.parse(read('package.json'))
const checks = [
  ['story rail uses compact vertical cards instead of oversized decorative avatar bubbles', story.includes('h-[158px] w-[104px]') && story.includes('Story updates') && !story.includes('w-[76px]')],
  ['story rail has one clear create-story action and avoids duplicate create controls', story.includes('Create story') && !story.includes('Share a moment · visible 24 hours')],
  ['story thumbnails preserve image loading through the private-media-aware image component', story.includes('<LazyImage src={thumb}')],
  ['story viewer resolves private media facade URLs through shared session-aware image/video primitives', story.includes('DurableVideo key={viewing.id} src={viewing.media.url}') && story.includes('DurableImage src={viewing.media.url}') && read('components/ghc/durable-video.tsx').includes('ghc:media-session-change') && read('components/ghc/durable-image.tsx').includes('ghc:media-session-change')],
  ['story viewer retains full-screen contain behavior for original media proportions', story.includes('object-contain sm:rounded-[1.7rem]')],
  ['profile and cover photos open a full-screen viewer without triggering upload', profile.includes('setMediaPreview({ url: cover') && profile.includes('setMediaPreview({ url: photo')],
  ['profile photo editing is a separate explicit camera action', profile.includes('aria-label="Change profile photo"') && profile.includes('setPhotoSheet("photo")')],
  ['cover editing is a separate explicit action', profile.includes('aria-label="Change cover photo"') && profile.includes('setPhotoSheet("cover")')],
  ['profile media viewer uses the shared accessible gallery lightbox', profile.includes('<MediaLightbox') && profile.includes('onClose={closeMediaPreview}')],
  ['shared lightbox supports modal semantics, Escape, arrow navigation and scroll lock', lightbox.includes('role="dialog"') && lightbox.includes('aria-modal="true"') && lightbox.includes('e.key === "Escape"') && lightbox.includes('ArrowLeft') && lightbox.includes('document.body.style.overflow = "hidden"')],
  ['lightbox renders full media without cropping', lightbox.includes('object-contain')],
  ['lightbox traps keyboard focus and restores focus to the opener', lightbox.includes('e.key === "Tab"') && lightbox.includes('previousFocusRef.current.focus()') && lightbox.includes('closeButtonRef.current?.focus()')],
  ['release metadata and UX gate are synchronized', pkg.version === JSON.parse(read('package-lock.json')).version && read('lib/app-release.ts').includes(`APP_RELEASE_VERSION = "${pkg.version}"`) && JSON.parse(read('package-lock.json')).version === pkg.version && pkg.scripts['check:social-story-profile-media-ux'] && pkg.scripts['prebuild:checks'].includes('check-social-story-profile-media-ux') && pkg.scripts['verify:static'].includes('check-social-story-profile-media-ux') && pkg.scripts['prebuild:checks'].includes('check-creator-media-preview-phase14') && pkg.scripts['verify:static'].includes('check-creator-media-preview-phase14')],
]
for (const [name, passed] of checks) { assert.equal(passed, true, name); console.log(`PASS ${name}`) }
console.log(`Social story and profile media UX: ${checks.length}/${checks.length} passed`)
