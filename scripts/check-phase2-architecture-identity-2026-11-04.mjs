#!/usr/bin/env node
/**
 * Phase 2 COMPLETE — Architecture & identity convergence source contract (2026-11-04).
 */
import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"

const root = process.cwd()
let pass = 0
let fail = 0
function ok(name, cond, detail = "") {
  if (cond) {
    pass++
    console.log(`PASS ${name}`)
  } else {
    fail++
    console.log(`FAIL ${name}${detail ? ` — ${detail}` : ""}`)
  }
}

const matchPath = join(root, "lib/identity/identity-match.ts")
const apiPath = join(root, "lib/client/api-request.ts")
const idSvc = join(root, "lib/identity/identity-service.ts")
const market = join(root, "components/ghc/marketplace-screen.tsx")
const idCtx = join(root, "contexts/identity-context.tsx")
const graph = join(root, "lib/social-graph.ts")
const earnings = join(root, "components/ghc/unified-earnings-dashboard.tsx")
const rewards = join(root, "components/ghc/rewards-centre-screen.tsx")
const discovery = join(root, "components/ghc/discovery-grid-screen.tsx")
const profileDom = join(root, "lib/domains/profile-domain.ts")

ok("identity-match module exists", existsSync(matchPath))
ok("api-request module exists", existsSync(apiPath))

const match = existsSync(matchPath) ? readFileSync(matchPath, "utf8") : ""
ok("isSameIdentity exported", match.includes("export function isSameIdentity"))
ok("isOwnedByCurrentUser exported", match.includes("export function isOwnedByCurrentUser"))
ok("getSessionIdentityAliases exported", match.includes("export function getSessionIdentityAliases"))
ok("idListIncludes exported", match.includes("export function idListIncludes"))

const api = existsSync(apiPath) ? readFileSync(apiPath, "utf8") : ""
ok("apiRequest uses IdentityService headers", api.includes("IdentityService.getAuthHeaders"))
ok("apiRequest has timeout", api.includes("timeoutMs") && api.includes("AbortController"))
ok("apiRequest humanizes errors", api.includes("humanizeClientErrorCode") || api.includes("toClientSafeErrorMessage"))

const svc = existsSync(idSvc) ? readFileSync(idSvc, "utf8") : ""
ok("IdentityService.matchesUserId", svc.includes("matchesUserId"))
ok("IdentityService.getIdentityAliases", svc.includes("getIdentityAliases"))

const mkt = existsSync(market) ? readFileSync(market, "utf8") : ""
ok("marketplace uses isOwnedByCurrentUser", mkt.includes("isOwnedByCurrentUser"))
ok("addToCart blocks own listings", mkt.includes("You can't add your own listing"))

const ctx = existsSync(idCtx) ? readFileSync(idCtx, "utf8") : ""
ok("IdentityContext exposes matchesUserId", ctx.includes("matchesUserId"))

const g = existsSync(graph) ? readFileSync(graph, "utf8") : ""
ok("social-graph uses idListIncludes", g.includes("idListIncludes"))

const earn = existsSync(earnings) ? readFileSync(earnings, "utf8") : ""
ok("earnings dashboard uses apiRequest", earn.includes("apiRequest"))

const rew = existsSync(rewards) ? readFileSync(rewards, "utf8") : ""
ok("rewards claim uses apiRequest", rew.includes("apiRequest") && rew.includes("/api/economy/rewards/claim"))

const disc = existsSync(discovery) ? readFileSync(discovery, "utf8") : ""
ok("discovery self-filter uses isSameIdentity", disc.includes("isSameIdentity"))

const pd = existsSync(profileDom) ? readFileSync(profileDom, "utf8") : ""
ok("profile-domain uses identity match", pd.includes("isOwnedByCurrentUser") || pd.includes("idListIncludes"))

const doc = join(root, "docs/PHASE-2-ARCHITECTURE-IDENTITY-2026-11-04.md")
ok("phase 2 doc present", existsSync(doc))

console.log("")
console.log(`Phase 2 architecture/identity COMPLETE: ${pass}/${pass + fail} passed`)
process.exit(fail ? 1 : 0)
