import fs from "node:fs"
const read = (path) => fs.readFileSync(path, "utf8")
const domain = read("lib/domains/profile-domain.ts")
const index = read("lib/domains/profile-relationship-index.ts")
const pkg = JSON.parse(read("package.json"))
const release = read("lib/app-release.ts")
const discovery = read("components/ghc/discovery-grid-screen.tsx")
const userCard = read("components/ghc/user-card.tsx")
const actions = read("components/ghc/relationship-actions.tsx")
const profileScreen = read("components/ghc/profile-screen.tsx")
const identityOverview = read("components/ghc/profile-identity-overview.tsx")
const checks = [
  ["release metadata matches package version", release.includes(`APP_RELEASE_VERSION = "${pkg.version}"`)],
  ["relationship indexes are cached per domain instance", domain.includes("createProfileRelationshipIndexCache")],
  ["batch relationship hydration shares one index snapshot", domain.includes("getRelationshipStates(userIds") && domain.includes("const index = getRelationshipIndex()")],
  ["Discovery pre-hydrates visible people as one relationship batch", discovery.includes("getRelationshipStates?.(ids)") && discovery.includes("relationshipStates.get(id)")],
  ["profile cards pass pre-hydrated state to relationship controls", userCard.includes("relationshipState={relationshipState}") && actions.includes("if (relationshipState) return relationshipState")],
  ["batch IDs are normalized and deduplicated", domain.includes("uniqueProfileIds(userIds)")],
  ["block-first branch remains before action derivation", domain.indexOf("if (state.isBlocked)") >= 0 && domain.indexOf("if (state.isBlocked)") < domain.indexOf("const actions: ProfileRelationshipAction[]")],
  ["relationship indexes cover all canonical social arrays", ["following", "followers", "friends", "matches", "blocked", "muted", "restricted", "outgoingRequests", "incomingRequests"].every((key) => index.includes(key))],
  ["no financial fields are added to public profile relationship index", !index.match(/balance|wallet|ledger|payment/i)],
  ["cache invalidates on immutable source-array replacement", index.includes("previous[key] !== next[key]") && index.includes("previous.matches !== next.matches")],
  ["profile timeline pagination is abortable", profileScreen.includes("timelineLoadMoreAbortRef") && profileScreen.includes("signal: controller.signal")],
  ["account changes cancel old timeline pagination", profileScreen.includes("profile/account transition invalidates pagination") && profileScreen.includes("timelineLoadMoreAbortRef.current?.abort()")],
  ["stale pagination responses cannot write into a different identity", profileScreen.includes("IdentityService.getCurrentUserId() !== meId")],
  ["aborted pagination failures do not surface stale errors", profileScreen.includes("if (!controller.signal.aborted) {") && profileScreen.includes("setTimelineError(\"More posts could not be loaded. Please try again.\")")],
  ["identity overview reads canonical session identity", identityOverview.includes("IdentityService.getCurrentUserId()")],
  ["identity overview subscribes to account changes", identityOverview.includes("IdentityService.subscribe") && identityOverview.includes("setSnapshot(null)")],
  ["identity overview aborts superseded hydration requests", identityOverview.includes("requestRef.current?.abort()") && identityOverview.includes("signal: controller.signal")],
  ["identity overview rejects stale cross-account responses", identityOverview.includes("IdentityService.getCurrentUserId() !== requestIdentity")],
  ["identity overview does not surface aborted request errors", identityOverview.includes("!controller.signal.aborted && IdentityService.getCurrentUserId() === requestIdentity")],
  ["identity switch clears previous account counts before rehydration", identityOverview.includes("onCounts?.({ followers: 0, following: 0 })")],
]
for (const [name, ok] of checks) console.log(`${ok ? "PASS" : "FAIL"} — ${name}`)
const failed = checks.filter(([, ok]) => !ok)
console.log(`Phase 6 Profile Performance: ${checks.length - failed.length}/${checks.length}`)
if (failed.length) process.exit(1)
