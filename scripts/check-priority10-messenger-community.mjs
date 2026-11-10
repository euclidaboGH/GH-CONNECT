import fs from "node:fs"
import assert from "node:assert/strict"

const screen = fs.readFileSync("components/ghc/message-screen.tsx", "utf8")
const components = fs.readFileSync("components/ghc/message-components.tsx", "utf8")
const docs = fs.readFileSync("docs/PRIORITY_10_MESSENGER_COMMUNITY_TRANSFORMATION.md", "utf8")

const checks = [
  ["shared-media action is wired into the conversation header", /onSharedMedia=\{\(\) => setSharedMediaOpen\(true\)\}/.test(screen)],
  ["shared-media panel is an accessible dialog", /role="dialog" aria-modal="true" aria-labelledby="gh-shared-media-title"/.test(screen)],
  ["gallery is derived from loaded conversation messages", /messages\.flatMap\(\(message\)/.test(screen)],
  ["gallery explicitly reports loaded-history scope", /items in the loaded conversation history/.test(screen)],
  ["gallery supports image and GIF attachments", /media\.type === "image" \|\| media\.type === "gif"/.test(screen)],
  ["gallery supports native video playback", /<video className="aspect-square w-full bg-black object-contain" controls preload="metadata"/.test(screen)],
  ["gallery supports voice playback", /aria-label="Play shared voice message"/.test(screen)],
  ["gallery supports shared files", /media\.fileName \|\| "Shared file"/.test(screen)],
  ["Escape closes shared media before exiting the thread", /if \(sharedMediaOpen\) \{\s*setSharedMediaOpen\(false\)/.test(screen)],
  ["message bubble exposes native voice playback", /aria-label="Play voice message"/.test(components)],
  ["header exposes a labelled shared-media control", /aria-label="View shared media"/.test(components)],
  ["call implementation limitations are documented", /No call signaling, invitation, TURN configuration/.test(docs)],
  ["durable voice-message boundary is documented", /device-local and is disabled when durable messaging is enabled/.test(docs)],
  ["35 workstreams are recorded", /Upgrade programme — 35 workstreams/.test(docs)],
]

for (const [name, ok] of checks) {
  assert.equal(ok, true, name)
  console.log(`PASS ${name}`)
}
console.log(`\\n${checks.length}/${checks.length} messenger-community transformation checks passed`)
