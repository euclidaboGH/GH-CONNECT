import fs from "node:fs"
const read = p => fs.readFileSync(p, "utf8")
const pkg = JSON.parse(read("package.json"))
const release = read("lib/app-release.ts")
const feed = read("components/ghc/enhanced-feed-screen.tsx")
const post = read("components/ghc/enhanced-post-card.tsx")
const css = read("app/globals.css")
const checks = [
  ["release 0.238.0", release.includes(`APP_RELEASE_VERSION = "${pkg.version}"`)],
  ["focused feed column", feed.includes("gh-premium-feed-list gh-feed-column") && css.includes("width: min(100%, 48rem)")],
  ["mobile toolbar targets", feed.includes('h-11 w-11') && feed.includes('aria-label={t("personalizeFeed")}')],
  ["quality hierarchy", post.includes('aria-label="Quality votes"') && post.includes("Community curation") && post.includes("Your vote helps surface useful contributions")],
  ["response actions preserved", post.includes('aria-label="Comment"') && post.includes('aria-label="Share"') && post.includes('Unsave')],
  ["server curation preserved", post.includes("socialSetCuration") && post.includes("server confirmation")],
  ["accessible social cards", post.includes('role="article"') && post.includes("focus-visible")],
  ["reduced motion respected", css.includes("prefers-reduced-motion: reduce")],
  ["canonical feed filters preserved", feed.includes('value: "for-you"') && feed.includes('value: "communities"') && feed.includes('value: "saved"')],
  ["no fake social metrics", !post.includes("Math.random") && !feed.includes("Math.random")],
]
let failed=0
for (const [name,ok] of checks) { console.log(`${ok?"PASS":"FAIL"} — ${name}`); if(!ok) failed++ }
console.log(`\nPass 16 unified-social-loop gate: ${checks.length-failed}/${checks.length}`)
if(failed) process.exit(1)
