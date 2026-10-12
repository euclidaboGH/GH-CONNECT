/**
 * Static gate: step-up on sensitive money/membership routes + WebAuthn step-up path.
 */
import { readFileSync, existsSync } from "fs"
import { join } from "path"

const root = process.cwd()
const fails = []

function read(rel) {
  const p = join(root, rel)
  if (!existsSync(p)) {
    fails.push(`missing: ${rel}`)
    return ""
  }
  return readFileSync(p, "utf8")
}

const requiredStepUp = [
  "app/api/economy/transfers/route.ts",
  "app/api/economy/ledger/spend/route.ts",
  "app/api/economy/transfer-requests/[requestId]/accept/route.ts",
  "app/api/economy/withdrawals/route.ts",
  "app/api/membership/activate/route.ts",
  "app/api/auth/sessions/revoke-others/route.ts",
]

for (const rel of requiredStepUp) {
  const t = read(rel)
  if (!t.includes("requireRecentStepUp")) {
    fails.push(`${rel} must call requireRecentStepUp`)
  }
}

const stepUpRoute = read("app/api/auth/step-up/route.ts")
if (!stepUpRoute.includes("createStepUp") && !stepUpRoute.includes("STEP_UP")) {
  fails.push("POST /api/auth/step-up missing")
}

const webauthnVerify = read("app/api/auth/webauthn/authenticate/verify/route.ts")
if (webauthnVerify && !webauthnVerify.includes("createStepUp")) {
  fails.push("WebAuthn authenticate verify should establish step-up")
}

const stepStore = read("lib/server/identity/step-up-store.ts")
if (!stepStore.includes("requireRecentStepUp")) {
  fails.push("step-up-store.requireRecentStepUp required")
}

if (fails.length) {
  console.error("test-identity-authz-static FAILED:")
  fails.forEach((f) => console.error(" -", f))
  process.exit(1)
}
console.log("test-identity-authz-static: PASS")
