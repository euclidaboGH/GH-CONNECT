#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
const root = process.cwd()
const read = (p) => readFileSync(join(root, p), 'utf8')
const app = read('components/ghc/app.tsx')
const css = read('app/globals.css')
const empty = read('components/ghc/empty-state.tsx')
const stories = read('components/ghc/profile-story-section.tsx')
const feed = read('components/ghc/enhanced-feed-screen.tsx')
const checks = []
const test = (n, ok) => { checks.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${n}`) }

test('Toast host uses z-[220]', /z-\[220\]/.test(app) && /gh-toast-host/.test(app))
test('Toast cards are non-pill professional surfaces', /rounded-2xl border/.test(app) && /pointer-events-auto/.test(app))
test('Tab panels use 200ms ease-out transition', /gh-tab-panel/.test(app) && /duration-200 ease-out/.test(app))
test('CSS toast-in animation + reduced motion', /gh-toast-in/.test(css) && /prefers-reduced-motion/.test(css))
test('Feed post slots content-visibility', /gh-feed-post-slot/.test(css) && /contain-intrinsic-size/.test(css))
test('Stories rail snap class', /gh-stories-rail/.test(stories) && /Stories/.test(stories))
test('Feed empty uses design-system variant', /variant="feed"/.test(feed))
test('Marketplace empty-state preset', /marketplace/.test(empty) && /Marketplace is open/.test(empty))
test('Stories remain on feed', /ProfileStorySection scope="feed"/.test(feed) || /scope="feed"/.test(feed))
test('Ecosystem polish constants module', existsSync(join(root, 'lib/ui/ecosystem-polish.ts')))

const failed = checks.filter((x) => !x).length
console.log(`\nPhase E ecosystem polish: ${checks.length - failed}/${checks.length} passed`)
process.exit(failed ? 1 : 0)
