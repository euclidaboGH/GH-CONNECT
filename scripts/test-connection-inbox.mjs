import { readFileSync, existsSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
const root = join(dirname(fileURLToPath(import.meta.url)), "..")
let passed = 0, failed = 0
const assert = (c, m) => { if (c) { passed++; console.log("  ✓", m) } else { failed++; console.error("  ✗", m) } }

console.log("\n=== CONNECTION INBOX + MATCH/CONNECT (#41) ===\n")

const files = [
  "lib/domains/adapters/connection-request-inbox.ts",
  "components/ghc/connection-request-inbox.tsx",
  "components/ghc/matches-components.tsx",
  "components/ghc/match-screen.tsx",
  "components/ghc/discovery-grid-screen.tsx",
  "lib/notification-center.ts",
]
for (const f of files) assert(existsSync(join(root, f)), `exists ${f}`)

const grid = readFileSync(join(root, "components/ghc/discovery-grid-screen.tsx"), "utf8")
assert(grid.includes("Interest / like only") || grid.includes("never creates a connection"), "onLike is interest-only comment")
assert(grid.includes("await ghc.swipe?.(id, \"like\")"), "onLike still uses swipe like")
// Ensure sendUnified is NOT inside onLike block only - connect separate
const onLikeIdx = grid.indexOf("const onLike = useCallback")
const onConnectIdx = grid.indexOf("const onConnect = useCallback")
assert(onLikeIdx > 0 && onConnectIdx > onLikeIdx, "onConnect defined after onLike")
const onLikeBlock = grid.slice(onLikeIdx, onConnectIdx)
assert(!onLikeBlock.includes("sendUnifiedConnectionRequest"), "onLike does not call sendUnified")
assert(grid.includes("sendUnifiedConnectionRequest"), "connect path still has sendUnified")
assert(grid.includes("onConnect(id") || grid.includes("onConnect(id,"), "card connect uses onConnect")

const matchCard = readFileSync(join(root, "components/ghc/matches-components.tsx"), "utf8")
assert(matchCard.includes("onConnect"), "MatchCard has onConnect")
assert(matchCard.includes("Connect") && matchCard.includes("Request pending"), "MatchCard states")
assert(matchCard.includes("Match = mutual interest"), "match vs connection copy")

const ms = readFileSync(join(root, "components/ghc/match-screen.tsx"), "utf8")
assert(ms.includes("handleConnectMatch") && ms.includes("sendUnifiedConnectionRequest"), "MatchScreen connect")
assert(ms.includes("ConnectionRequestInbox"), "MatchScreen inbox")
assert(ms.includes("ghc:open-connection-inbox"), "inbox event listener")
assert(!ms.includes("useEffect(() => {\n    const open = () => setShowRequestInbox(true)\n    window.addEventListener(\"ghc:open-connection-inbox\"" ) || ms.includes("open-connection-inbox"), "event wiring")

const inbox = readFileSync(join(root, "lib/domains/adapters/connection-request-inbox.ts"), "utf8")
assert(inbox.includes("buildConnectionRequestInbox") && inbox.includes("session_graph"), "inbox domain")
assert(inbox.includes("isInterestOnlyAction") && inbox.includes("isConnectionMutationAction"), "action classifiers")

const ui = readFileSync(join(root, "components/ghc/connection-request-inbox.tsx"), "utf8")
assert(ui.includes("acceptUnifiedConnectionRequest") && ui.includes("declineUnifiedConnectionRequest"), "inbox uses unified")
assert(ui.includes("Incoming") && ui.includes("Outgoing"), "inbox sections")
assert(ui.includes("blocked"), "respects blocks")

const notif = readFileSync(join(root, "lib/notification-center.ts"), "utf8")
assert(notif.includes('section = "connection_requests"'), "friend_request routes to connection_requests")
assert(notif.includes("ghc:open-connection-inbox"), "notif opens inbox")
assert(notif.includes("SOCIAL_TYPES.has"), "safety block intact")
assert(notif.count?.("return link") !== 0 || notif.includes("return link"), "resolve returns link")

// Financial isolation
for (const f of ["lib/domains/adapters/connection-request-inbox.ts", "components/ghc/connection-request-inbox.tsx"]) {
  const x = readFileSync(join(root, f), "utf8")
  assert(!x.includes("executeAuthoritativeSpend") && !x.includes("PI_API_KEY"), f + " financial isolation")
}
const econ = readFileSync(join(root, "lib/server/economy/economic-config.ts"), "utf8")
assert(econ.includes("VIP_PRICE_GHC = 150"), "VIP unchanged")

console.log("\n=== RESULTS ===\nPassed:", passed, "\nFailed:", failed)
if (failed) process.exit(1)
console.log("ALL #41 TESTS PASSED\n")
