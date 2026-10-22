#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs"
let failures = 0
const check = (condition, label) => {
  if (condition) console.log("PASS", label)
  else { console.error("FAIL", label); failures++ }
}
const upload = readFileSync("lib/media/upload-client.ts", "utf8")
check(upload.includes("async function fetchWithPiSessionRecovery"), "shared media requests have Pi-session recovery")
check((upload.match(/fetchWithPiSessionRecovery\("\/api\/media/g) || []).length === 3, "proxy, direct intent, and completion use session recovery")
check(upload.includes('fetch("/api/auth/pi"'), "recovery uses the existing server-verified Pi auth bridge")
check(upload.includes('result.verified !== true'), "recovery requires server verification before retry")
check(!upload.includes('window.location') && !upload.includes('router.push("/login")'), "media helper does not redirect to login on upload failure")
const identity = readFileSync("lib/identity/identity-service.ts", "utf8")
check(identity.includes('process.env.NODE_ENV !== "production" && identity.userId'), "synthetic user bearer is development-only")
const prompt = readFileSync("components/ghc/daily-claim-prompt.tsx", "utf8")
check(prompt.includes("alreadyClaimed: boolean"), "claim result distinguishes already-claimed from newly claimed")
check(prompt.includes('if (!alreadyClaimed) reportDailyClaimSuccess(amountLabel)'), "already-claimed response does not announce a new reward")
check(prompt.includes("!rewardSheetOpen && Boolean(userId)"), "global prompt is suppressed while detailed reward sheet is open")
const experience = readFileSync("components/ghc/daily-reward-experience.tsx", "utf8")
check(experience.includes('ghc:daily-reward-sheet-visibility'), "detailed reward sheet publishes modal visibility")
check(!experience.includes('setTimeout(() => setSheetOpen(true), 1600)'), "detailed sheet no longer auto-opens over the global prompt")
check(experience.includes('onOpenFull={() => setSheetOpen(true)}'), "feed card remains a manual sheet entry point")
const icon = readFileSync("components/ghc/ghc-coin-icon.tsx", "utf8")
check(icon.includes('loading="eager"'), "GHC coin logo is not deferred in the modal")
check(existsSync("public/ghc-coin-logo.png") && existsSync("public/ghc-coin-32.png"), "official GHC coin assets exist")
if (failures) process.exit(1)
console.log(`\nPi media recovery + daily claim UI checks: ${14 - failures}/14 passed`)
