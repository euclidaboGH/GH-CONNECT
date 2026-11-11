#!/usr/bin/env node
import { buildCommentTree, filterBlockedCommentThreads, countThread } from "../lib/comment-thread-utils.ts"

const assert = (condition, label) => {
  if (!condition) throw new Error(`FAIL ${label}`)
  console.log(`PASS ${label}`)
}
const comments = [
  { id: "root", authorId: "alice", authorName: "Alice", text: "root", createdAt: 10 },
  { id: "reply", authorId: "bob", authorName: "Bob", text: "reply", replyTo: "root", createdAt: 11 },
  { id: "blocked", authorId: "blocked-user", authorName: "Blocked", text: "hidden", replyTo: "root", createdAt: 12 },
  { id: "blocked-child", authorId: "carol", authorName: "Carol", text: "hidden descendant", replyTo: "blocked", createdAt: 13 },
  { id: "orphan", authorId: "dave", authorName: "Dave", text: "orphan", replyTo: "missing", createdAt: 14 },
  { id: "cycle-a", authorId: "erin", authorName: "Erin", text: "A", replyTo: "cycle-b", createdAt: 15 },
  { id: "cycle-b", authorId: "frank", authorName: "Frank", text: "B", replyTo: "cycle-a", createdAt: 16 },
  { id: "bad-time", authorId: "gina", authorName: "Gina", text: "no timestamp" },
]
const filtered = filterBlockedCommentThreads(comments, ["blocked-user"])
assert(!filtered.some((row) => row.id === "blocked"), "blocked author comment is removed")
assert(!filtered.some((row) => row.id === "blocked-child"), "descendants of blocked comment are removed")
assert(filtered.some((row) => row.id === "reply"), "other replies in visible thread remain")
const tree = buildCommentTree(filtered)
const allIds = new Set()
const walk = (nodes) => {
  for (const node of nodes) {
    if (allIds.has(node.id)) throw new Error(`duplicate tree node ${node.id}`)
    allIds.add(node.id)
    walk(node.replies || [])
  }
}
walk(tree)
assert(allIds.size === filtered.length, "all visible comments survive tree construction exactly once")
assert(tree.some((row) => row.id === "orphan"), "orphan replies are promoted to visible roots")
assert(tree.some((row) => row.id === "cycle-a") && tree.some((row) => row.id === "cycle-b"), "malformed cyclic replies are preserved as roots")
const badTime = tree.find((row) => row.id === "bad-time")
assert(badTime?.createdAt === 0, "missing timestamps normalize deterministically")
assert(countThread(tree.find((row) => row.id === "root")) === 1, "visible thread counts only visible descendants")
console.log("Run 272 comment-thread tests: 8/8 passed")
