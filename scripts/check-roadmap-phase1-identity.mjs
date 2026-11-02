import fs from "node:fs"
import path from "node:path"
const root = process.cwd()
const read = (p) => fs.readFileSync(path.join(root, p), "utf8")
const checks = [
  ["identity account center exists", fs.existsSync(path.join(root, "components/ghc/identity-account-center.tsx"))],
  ["profile screen imports identity center", read("components/ghc/profile-screen.tsx").includes('from "./identity-account-center"')],
  ["profile screen renders identity center", read("components/ghc/profile-screen.tsx").includes("<IdentityAccountCenter />")],
  ["identity status uses server endpoint", read("components/ghc/identity-account-center.tsx").includes('fetch("/api/identity/me"')],
  ["profile completeness is derived from profile fields", read("components/ghc/identity-account-center.tsx").includes("PROFILE_FIELDS.filter")],
  ["audience preview clearly says it does not change privacy", read("components/ghc/identity-account-center.tsx").includes("does not change privacy settings")],
  ["export endpoint authenticates caller", read("app/api/profile/export/route.ts").includes("resolveAuthenticatedUser")],
  ["export excludes private tokens and internal UID", read("app/api/profile/export/route.ts").includes("excludes tokens, session secrets, internal Pi UID")],
  ["export is rate limited and no-store", read("app/api/profile/export/route.ts").includes("profile-export:") && read("app/api/profile/export/route.ts").includes('"Cache-Control": "no-store"')],
  ["export does not include financial records", read("app/api/profile/export/route.ts").includes("wallet balances and financial records")],
]
let failed = 0
for (const [label, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`)
  if (!ok) failed++
}
console.log(`Identity roadmap Phase 1: ${checks.length - failed}/${checks.length}`)
if (failed) process.exitCode = 1
