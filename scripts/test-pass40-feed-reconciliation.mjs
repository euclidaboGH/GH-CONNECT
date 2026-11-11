#!/usr/bin/env node
import assert from "node:assert/strict"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"

const moduleUrl = pathToFileURL(resolve(process.cwd(), "lib/social/reconcile-feed-posts.ts"))
const { reconcileFeedPosts } = await import(moduleUrl.href)
const post = (id, createdAt, extra = {}) => ({
  id,
  authorId: "user-1",
  authorName: "Member",
  authorPhoto: "",
  content: id,
  images: [],
  video: null,
  pdf: null,
  pdfName: null,
  likes: 0,
  comments: [],
  createdAt,
  ...extra,
})

const current = [
  post("shared", 10, { content: "stale local copy" }),
  post("offline-draft", 20),
  post("duplicate", 5),
  post("duplicate", 4, { content: "duplicate copy" }),
  post("deleted-local", 30, { deletedAt: 30 }),
  post("   ", 40),
]
const remote = [
  post("shared", 15, { content: "server copy" }),
  post("remote-new", 25),
  post("remote-new", 24, { content: "duplicate remote copy" }),
]

const replaced = reconcileFeedPosts(current, remote, "replace")
assert.deepEqual(replaced.map((item) => item.id), ["remote-new", "offline-draft", "shared", "duplicate"])
assert.equal(replaced.find((item) => item.id === "shared")?.content, "server copy")
assert.equal(replaced.find((item) => item.id === "remote-new")?.content, "remote-new")
assert.equal(replaced.some((item) => item.id === "deleted-local"), false)
assert.equal(replaced.some((item) => !item.id.trim()), false)

// Match canonical SQL ordering so the last row is a valid keyset cursor.
const tied = reconcileFeedPosts([
  post("tie-a", 100), post("tie-c", 100), post("tie-b", 100),
], [post("tie-d", 100), post("tie-c", 100)], "replace")
assert.deepEqual(tied.map((item) => item.id), ["tie-d", "tie-c", "tie-b", "tie-a"])
assert.equal(tied.at(-1)?.id, "tie-a")

const appended = reconcileFeedPosts([post("existing", 30), post("shared", 10)], [post("shared", 99), post("new", 20)], "append")
assert.deepEqual(appended.map((item) => item.id), ["existing", "new", "shared"])
assert.equal(appended.find((item) => item.id === "shared")?.createdAt, 10)

const emptyRemote = reconcileFeedPosts([post("offline-only", 1), post("deleted", 2, { deletedAt: 2 })], [], "replace")
assert.deepEqual(emptyRemote.map((item) => item.id), ["offline-only"])

console.log("PASS replace mode prefers server rows and retains local-only continuity")
console.log("PASS append mode adds only unseen server rows")
console.log("PASS duplicate IDs, blank IDs and deleted local rows are excluded")
console.log("PASS equal timestamps match canonical SQL DESC/DESC ordering and preserve the keyset cursor")
console.log("PASS empty remote replacement retains only eligible local continuity rows")
console.log("Pass 40 runtime reconciliation tests: 6/6")
