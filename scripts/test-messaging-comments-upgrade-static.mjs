/**
 * Static gate: messaging + comments upgrade helpers and wiring.
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

const mux = read("lib/messaging/messaging-ux.ts")
for (const k of ["MAX_MESSAGE_LENGTH", "loadConversationDraft", "saveConversationDraft", "clipMessageText"]) {
  if (!mux.includes(k)) fails.push(`messaging-ux missing ${k}`)
}

const msg = read("components/ghc/message-screen.tsx")
if (!msg.includes("loadConversationDraft")) fails.push("message-screen must restore drafts")
if (!msg.includes("clipMessageText")) fails.push("message-screen must clip sends")
if (!msg.includes("MAX_MESSAGE_LENGTH")) fails.push("message-screen must know max length")

const mc = read("components/ghc/message-components.tsx")
if (!mc.includes("MAX_MESSAGE_LENGTH") && !mc.includes("clipMessageText")) {
  fails.push("message-components should enforce max length")
}

const cux = read("lib/comments/comment-ux.ts")
for (const k of ["MAX_COMMENT_LENGTH", "loadCommentDraft", "reactionTotal"]) {
  if (!cux.includes(k)) fails.push(`comment-ux missing ${k}`)
}

const sheet = read("components/ghc/comment-sheet.tsx")
if (!sheet.includes("loadCommentDraft")) fails.push("comment-sheet must restore drafts")
if (!sheet.includes("isOffline")) fails.push("comment-sheet offline handling required")
if (!sheet.includes('"top"')) fails.push("comment-sheet top sort required")
if (!sheet.includes("useFocusTrap")) fails.push("comment-sheet focus trap required")
if (!sheet.includes("clipCommentText")) fails.push("comment-sheet must clip text")

if (fails.length) {
  console.error("test-messaging-comments-upgrade-static FAILED")
  fails.forEach((f) => console.error(" -", f))
  process.exit(1)
}
console.log("test-messaging-comments-upgrade-static: PASS")
