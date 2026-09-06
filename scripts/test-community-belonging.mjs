import { readFileSync, existsSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
const root = join(dirname(fileURLToPath(import.meta.url)), "..")
let passed = 0
let failed = 0
const assert = (c, m) => {
  if (c) {
    passed++
    console.log("  ✓", m)
  } else {
    failed++
    console.error("  ✗", m)
  }
}

console.log("\n=== COMMUNITY BELONGING (#44) ===\n")

const files = [
  "lib/domains/adapters/community-invites-adapter.ts",
  "lib/domains/adapters/community-people-you-may-know.ts",
  "lib/domains/adapters/my-communities-home.ts",
  "components/ghc/community-invite-card.tsx",
  "components/ghc/community-people-you-may-know.tsx",
  "components/ghc/home-command-centre.tsx",
  "lib/domains/community-domain.ts",
  "contexts/ghc-context.tsx",
]
for (const f of files) assert(existsSync(join(root, f)), `exists ${f}`)

const domain = readFileSync(join(root, "lib/domains/community-domain.ts"), "utf8")
assert(domain.includes("acceptInvitation") && domain.includes("declineInvitation"), "accept/decline domain")
assert(domain.includes("invitedMembers") && domain.includes("No active invitation"), "invite re-check")
assert(domain.includes("Cannot invite blocked user"), "invite blocks blocked users")

const inv = readFileSync(join(root, "lib/domains/adapters/community-invites-adapter.ts"), "utf8")
assert(inv.includes("listInvitationsForViewer") && inv.includes("isDemoDataAllowed"), "invites list + demo filter")

const pymk = readFileSync(join(root, "lib/domains/adapters/community-people-you-may-know.ts"), "utf8")
assert(pymk.includes("buildPeopleYouMayKnowInCommunity") && pymk.includes("filterMemberIdsForViewer"), "people + block filter")
assert(pymk.includes("shared_community") && !pymk.includes("compatibility"), "reasons no percent scores")

const my = readFileSync(join(root, "lib/domains/adapters/my-communities-home.ts"), "utf8")
assert(my.includes("listMyCommunitiesForHome") && my.includes("isMember"), "my communities membership")
assert(!my.includes("localStorage.getItem") && !my.includes("localStorage.setItem"), "not localStorage authority")

const card = readFileSync(join(root, "components/ghc/community-invite-card.tsx"), "utf8")
assert(card.includes("Accept") && card.includes("Decline"), "invite card actions")
assert(card.includes("no longer available"), "stale invite UI")
assert(card.includes("aria-label"), "invite card a11y")

const peopleUi = readFileSync(join(root, "components/ghc/community-people-you-may-know.tsx"), "utf8")
assert(
  peopleUi.includes("ConnectionIntentPicker") && peopleUi.includes("submitConnectionFromPicker"),
  "unified connect from community"
)

const home = readFileSync(join(root, "components/ghc/home-command-centre.tsx"), "utf8")
assert(home.includes("My communities") || home.includes("my communities"), "home my communities")
assert(home.includes("haven’t joined") || home.includes("haven't joined"), "empty membership copy")
assert(home.includes("CommunityInviteCard") && home.includes("listMyCommunitiesForHome"), "home invites + list")
assert(home.includes("export function HomeCommandCentre"), "home exports")
assert(home.includes("onCompose: _onCompose"), "home signature ok")
assert(home.includes("acceptCommunityInvitation"), "accept wired")

const ctx = readFileSync(join(root, "contexts/ghc-context.tsx"), "utf8")
assert(ctx.includes("acceptCommunityInvitation") && ctx.includes("declineCommunityInvitation"), "context methods")
assert(ctx.includes("acceptInvitation") && ctx.includes("declineInvitation"), "domain calls")

const mig = join(root, "supabase/migrations/20260906_community_join_reasons_proposal.sql")
assert(existsSync(mig), "join reason proposal file exists")
const migt = readFileSync(mig, "utf8")
assert(migt.includes("DO NOT APPLY") || migt.includes("PROPOSAL"), "migration not auto-apply")

for (const f of [
  "lib/domains/adapters/community-people-you-may-know.ts",
  "lib/domains/adapters/my-communities-home.ts",
  "components/ghc/community-invite-card.tsx",
]) {
  const x = readFileSync(join(root, f), "utf8")
  assert(!x.includes("PI_API_KEY") && !x.includes("executeAuthoritativeSpend"), f + " financial isolation")
}
const econ = readFileSync(join(root, "lib/server/economy/economic-config.ts"), "utf8")
assert(econ.includes("VIP_PRICE_GHC = 150"), "VIP unchanged")

console.log("\n=== RESULTS ===\nPassed:", passed, "\nFailed:", failed)
if (failed) process.exit(1)
console.log("ALL #44 BELONGING TESTS PASSED\n")
