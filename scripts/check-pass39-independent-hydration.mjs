#!/usr/bin/env node
import { readFileSync } from "node:fs"
import { join } from "node:path"
const read = (file) => readFileSync(join(process.cwd(), file), "utf8")
const context = read("contexts/ghc-context.tsx")
const pkg = JSON.parse(read("package.json"))
const lock = JSON.parse(read("package-lock.json"))
const release = read("lib/app-release.ts")
const prebuild = pkg.scripts?.prebuild || ""
const truth = read("docs/PROJECT_TRUTH.md")
const manifest = read("VERIFIED_MANIFEST.txt")
const checks = [
  ["social domain hydration uses independent settled requests", context.includes("const [feedResult, storiesResult, followsResult] = await Promise.allSettled(")],
  ["feed hydration accepts successful feed response independently", context.includes('const feed = feedResult.status === "fulfilled" ? feedResult.value : null') && context.includes("if (feed?.ok && Array.isArray(feed.posts)")],
  ["stories hydration accepts successful stories response independently", context.includes('const stories = storiesResult.status === "fulfilled" ? storiesResult.value : null') && context.includes("if (stories?.ok && Array.isArray(stories.stories)")],
  ["follow graph hydration accepts successful follows response independently", context.includes('const follows = followsResult.status === "fulfilled" ? followsResult.value : null') && context.includes("if (follows?.ok)")],
  ["cancelled hydration cannot commit late results", /if \(cancelled\) return\s*\n\s*const feed = feedResult/.test(context)],
  ["release metadata is synchronized", pkg.version === lock.version && lock.packages?.[""]?.version === pkg.version && release.includes(`APP_RELEASE_VERSION = "${pkg.version}"`)],
  ["project truth and verified manifest identify current release", truth.includes(`**Current source version:** \`${pkg.version}\``) && manifest.includes(`project_version=${pkg.version}`)],
  ["independent hydration gate runs before production build", prebuild.includes("node scripts/check-pass39-independent-hydration.mjs")],
  ["no financial execution code was added to hydration changes", !/executeSpend|walletBalance\s*=|ledger\.insert|payment\.complete/i.test(context.slice(context.indexOf("// Durable social hydrate"), context.indexOf("// After social writes")))],
]
let failures = 0
for (const [label, pass] of checks) { console.log(`${pass ? "PASS" : "FAIL"} ${label}`); if (!pass) failures++ }
console.log(`Pass 39 independent domain hydration: ${checks.length - failures}/${checks.length}`)
if (failures) process.exit(1)
