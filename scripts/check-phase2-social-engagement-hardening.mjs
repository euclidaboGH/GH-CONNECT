import fs from "node:fs"
import assert from "node:assert/strict"

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8")
const context = read("../contexts/ghc-context.tsx")
const comments = read("../components/ghc/comment-sheet.tsx")
const feed = read("../components/ghc/enhanced-feed-screen.tsx")
const collections = read("../lib/feed-profile-experience.ts")
const collectionSheet = read("../components/ghc/save-to-collection.tsx")
const sharing = read("../components/ghc/share-sheet.tsx")

const checks = [
  ["comment mutation exposes durable success as a boolean", /addComment: \(postId: string, text: string[\s\S]{0,300}Promise<boolean>/.test(context)],
  ["comment submission preserves draft when mutation reports failure", /const saved = await addComment\([\s\S]{0,200}if \(saved === false\) return[\s\S]{0,100}setPendingMedia\(\[\]\)/.test(comments)],
  ["failed comment writes return false", /if \(!remote\.ok\)[\s\S]{0,350}return false/.test(context) && /if \(remote\.durable === false\)[\s\S]{0,350}return false/.test(context)],
  ["successful comment writes return true after reconciliation path", /addToast\(replyToCommentId \? "Reply posted" : "Comment posted", "success"\)[\s\S]{0,700}return true/.test(context)],
  ["save and unsave expose success booleans", /savePost: \(postId: string, collection\?: string\) => Promise<boolean>/.test(context) && /unsavePost: \(postId: string\) => Promise<boolean>/.test(context)],
  ["failed bookmark writes restore the feed bookmark state", /const saved = savePost \? await savePost\(postId\) : false[\s\S]{0,150}if \(!saved\)[\s\S]{0,100}setBookmarkedPostIds\(previous\)/.test(feed) && /const removed = unsavePost \? await unsavePost\(postId\) : false[\s\S]{0,100}if \(!removed\) setBookmarkedPostIds\(previous\)/.test(feed)],
  ["collection storage is account-scoped and versioned", /COLLECTIONS_KEY_PREFIX = "ghc_save_collections_v2"/.test(collections) && /collectionsStorageKey\(scopeId\)/.test(collections) && /Math\.imul\(first \^ code, 0x01000193\)/.test(collections) && /scopeId=\{feedPreferenceOwnerId\}/.test(feed)],
  ["collection persistence validates stored shape", /const parsed: unknown = JSON\.parse\(raw\)[\s\S]{0,600}Array\.isArray\(parsed\)/.test(collections)],
  ["collection copy distinguishes local organization from server bookmark", /stored on this device and separated by account[\s\S]{0,150}saved to your account separately/.test(collectionSheet)],
  ["share flow requires a durable server-confirmed share", /durableShare\.ok \|\| durableShare\.durable !== true/.test(sharing)],
  ["share mutation has an in-flight UI guard", /disabled=\{busy \|\|/.test(sharing) && /setBusy\(true\)[\s\S]{0,150}setError\(null\)/.test(sharing)],
]

let failed = 0
for (const [name, pass] of checks) {
  console.log(`${pass ? "PASS" : "FAIL"} ${name}`)
  if (!pass) failed += 1
}
console.log(`Phase 2 social engagement hardening: ${checks.length - failed}/${checks.length} checks passed`)
if (failed) process.exitCode = 1
