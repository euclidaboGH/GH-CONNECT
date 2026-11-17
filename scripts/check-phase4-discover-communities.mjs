#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"
const root = process.cwd()
let fail = 0
const ok = (label, cond) => {
  if (cond) console.log(`PASS ${label}`)
  else {
    console.log(`FAIL ${label}`)
    fail++
  }
}
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8")

const disc = read("components/ghc/discovery-grid-screen.tsx")
ok("modern photo cards default on", disc.includes("useState(true)") && disc.includes("useModernCard"))
ok("card mode toggle shows alternate label", disc.includes('useModernCard ? "Connection cards" : "Photo cards"'))
ok("follow success soft-revalidates", disc.includes("ghc:discover-soft-revalidate") && disc.includes('Following'))
ok("connect success soft-revalidates", disc.includes("Connection request sent") && disc.includes("ghc:discover-soft-revalidate"))
ok("candidate dedupe retained", disc.includes("Phase 1: stable dedupe") || disc.includes("dedupe"))
ok("followUser context path retained", disc.includes("followUser"))

const com = read("components/ghc/communities-screen.tsx")
ok("directory load 15s timeout", com.includes("15_000") && com.includes("Directory is taking longer"))
ok("discover empty clear filters", com.includes("Clear filters") && com.includes('setPrivacyFilter("all")'))
ok("privacy joinLabel on cards", com.includes("Request to join") && com.includes("joinLabel="))
ok("join gate privacy hint retained", com.includes("privacyJoinHint"))
ok("My tab filter skip retained", com.includes('directory === "my"') && com.includes("privacyFilter"))

const card = read("components/ghc/group-card.tsx")
ok("GroupCard joinLabel prop", card.includes("joinLabel?: string") && card.includes("{joinLabel}"))

const create = read("components/ghc/create-group-modal.tsx")
ok("create name min 3 validation", create.includes("at least 3 characters"))
ok("create description required", create.includes("Description is required") || create.includes("at least 10"))

console.log("")
console.log(`Phase 4 discover/communities: ${14 - fail}/14 passed`)
process.exit(fail ? 1 : 0)
