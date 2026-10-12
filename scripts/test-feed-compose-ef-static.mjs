/**
 * Section E (compose/feed) + F (graph/discover) static gates.
 */
import { readFileSync, existsSync } from "fs"
import { join } from "path"

const root = process.cwd()
const fails = []
const read = (rel) => {
  const p = join(root, rel)
  if (!existsSync(p)) { fails.push(`missing ${rel}`); return "" }
  return readFileSync(p, "utf8")
}

// E27 single host
const host = read("components/ghc/global-compose-host.tsx")
const postC = read("components/ghc/post-composer.tsx")
if (!host.includes("ghc:open-compose") || !host.includes("PostComposer")) {
  fails.push("GlobalComposeHost must own single composer via ghc:open-compose")
}
if (!postC.includes("UnifiedCompose")) {
  fails.push("PostComposer must wrap UnifiedCompose only")
}

// E28–E31 draft, offline, limits, alt
const uc = read("components/ghc/unified-compose.tsx")
if (!uc.includes("ghc-post-draft") && !uc.includes("post-draft")) fails.push("draft autosave missing")
if (!uc.includes("OFFLINE_COMPOSE_QUEUE_KEY") && !uc.includes("offline")) fails.push("offline compose path missing")
if (!uc.includes("MAX_POST_TEXT")) fails.push("MAX_POST_TEXT required")
if (!uc.includes("imageAlts") && !uc.includes("Alt text")) fails.push("image alt text UI required")

// E32 link preview server
if (!existsSync(join(root, "app/api/social/link-preview/route.ts"))) {
  fails.push("link-preview API required")
}
const lp = read("app/api/social/link-preview/route.ts")
if (!lp.includes("awardsValue: false") && !lp.includes("never awards") && !lp.includes("never awards GHC")) {
  if (!lp.includes("awardsValue")) fails.push("link preview must declare no value awards")
}
if (/creditGhc|mintGhc|awardGhc/i.test(lp)) fails.push("link preview must not mint GHC")

// E34 visibility
if (!uc.includes("Audience") || !uc.includes("public")) fails.push("audience/visibility picker required")

// E35 impressions no mint
const imp = read("app/api/social/ranking/impressions/route.ts")
if (/creditGhc|mintGhc|awardGhc|ledger\.credit/i.test(imp)) fails.push("impressions must not mint GHC")
if (imp.includes("executeAuthoritative") || imp.includes("rpcWallet")) fails.push("impressions must not touch wallet RPCs")

// E36 curation prefs
const cur = read("app/api/social/curation-preferences/route.ts")
if (!cur.includes("show_less") || !cur.includes("hide")) fails.push("curation hide/show_less required")

// F37 engagement separation — feed should not treat post likes as match likes
const feed = read("components/ghc/enhanced-feed-screen.tsx")
if (feed && feed.includes("Post-level likes deprecated")) {
  /* good */
} else if (feed && /match.*likePost|likePost.*match/i.test(feed)) {
  fails.push("feed likePost must not drive matching")
}

// F38 rejectMatch
const match = read("components/ghc/match-screen.tsx")
if (!match.includes("rejectMatch")) fails.push("match rejectMatch wiring required")

// F39 diversity
const rank = read("lib/feed-ranking-engine.ts")
if (!rank.includes("applyRankingDiversity") || !rank.includes("authorCap")) {
  fails.push("ranking diversity authorCap required")
}

// F40 search ignores client rank / filters mutes on feed
const search = read("app/api/social/search/route.ts")
if (!search.includes("void url.searchParams.get(\"userId\")") && !search.includes("Ignore client ranking")) {
  fails.push("search must ignore client ranking overrides")
}
const feedApi = read("app/api/social/feed/route.ts")
if (!feedApi.includes("mute") && !feedApi.includes("muted")) {
  fails.push("feed API should enforce mutes")
}

if (fails.length) {
  console.error("test-feed-compose-ef-static FAILED")
  fails.forEach((f) => console.error(" -", f))
  process.exit(1)
}
console.log("test-feed-compose-ef-static: PASS")
