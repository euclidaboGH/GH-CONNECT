import fs from "node:fs"
import assert from "node:assert/strict"

const screen = fs.readFileSync("components/ghc/message-screen.tsx", "utf8")
const components = fs.readFileSync("components/ghc/message-components.tsx", "utf8")
const plan = fs.readFileSync("docs/PRIORITY_10_FOUR_PHASE_EXECUTION_PLAN.md", "utf8")
const worklog = fs.readFileSync("docs/UPGRADE-WORKLOG-0.338.12.md", "utf8")

const checks = [
  ["conversation details control is wired from the active thread", /onDetails=\{\(\) => setConversationDetailsOpen\(true\)\}/.test(screen)],
  ["header details control has an accessible label", /aria-label="Conversation information and settings"/.test(components)],
  ["information centre is an accessible modal dialog", /role="dialog" aria-modal="true" aria-labelledby="gh-conversation-details-title"/.test(screen)],
  ["information centre reports conversation kind", /Community conversation|Group conversation|Direct conversation/.test(screen)],
  ["information centre reports available participant count", /participant IDs available in this conversation/.test(screen)],
  ["information centre reports loaded message and media counts", /Messages currently loaded/.test(screen) && /Shared items currently loaded/.test(screen)],
  ["information centre links to existing shared-media view", /setConversationDetailsOpen\(false\); setSharedMediaOpen\(true\)/.test(screen)],
  ["information centre preserves profile navigation", /ghc:open-profile/.test(screen)],
  ["Escape closes the information centre", /if \(conversationDetailsOpen\) \{\s*setConversationDetailsOpen\(false\)/.test(screen)],
  ["unimplemented preference contracts are not falsely represented as persisted", /not presented as configured here unless their durable settings are confirmed/.test(screen)],
  ["four phases are explicitly defined", /Phase 1 — Conversation foundation/.test(plan) && /Phase 2 — Durable media/.test(plan) && /Phase 3 — Real-time audio\/video calling/.test(plan) && /Phase 4 — Community communications/.test(plan)],
  ["35 workstreams are mapped", /35 workstreams/.test(plan) && /35\./.test(plan)],
  ["research sources cover Supabase and WebRTC", /supabase.com\/docs\/guides\/realtime\/authorization/.test(plan) && /webrtc.org\/getting-started\/peer-connections/.test(plan)],
  ["phase 1 is accurately marked in progress", /Phase 1 has started; it is not complete/.test(worklog)],
  ["no migration or auth relaxation is claimed", /No SQL migration, payment code, auth bypass, RLS relaxation/.test(worklog)],
]

for (const [name, ok] of checks) {
  assert.equal(ok, true, name)
  console.log(`PASS ${name}`)
}
console.log(`\\n${checks.length}/${checks.length} Phase 1 checks passed`)
