#!/usr/bin/env node
/**
 * Phase 5 product UX release gate — aggregates Phases 1–4 trust/media → feed polish.
 * SOURCE VERIFIED only. Does not prove DB apply, Testnet A2U, or Mainnet.
 */
import { spawnSync } from "node:child_process"
import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"

const root = process.cwd()
let pass = 0
let fail = 0

function ok(name, cond, detail = "") {
  if (cond) {
    pass++
    console.log("PASS", name)
  } else {
    fail++
    console.log("FAIL", name, detail)
  }
}

function runNested(rel) {
  const r = spawnSync(process.execPath, [join(root, rel)], {
    cwd: root,
    encoding: "utf8",
    env: process.env,
  })
  const out = `${r.stdout || ""}${r.stderr || ""}`
  if (r.status === 0) {
    pass++
    console.log("PASS nested", rel)
  } else {
    fail++
    console.log("FAIL nested", rel)
    console.log(out.split("\n").filter((l) => l.includes("FAIL")).slice(0, 12).join("\n"))
  }
}

const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"))
const lock = JSON.parse(readFileSync(join(root, "package-lock.json"), "utf8"))
const release = readFileSync(join(root, "lib/app-release.ts"), "utf8")
const manifest = readFileSync(join(root, "VERIFIED_MANIFEST.txt"), "utf8")
const truth = existsSync(join(root, "docs/PROJECT_TRUTH.md"))
  ? readFileSync(join(root, "docs/PROJECT_TRUTH.md"), "utf8")
  : ""

ok("package version is a valid semver", /^\d+\.\d+\.\d+$/.test(pkg.version))
ok("lockfile root version matches", lock.version === pkg.version)
ok("lock packages root version matches", lock.packages?.[""]?.version === pkg.version)
ok("APP_RELEASE_VERSION matches package", release.includes(`APP_RELEASE_VERSION = "${pkg.version}"`))
ok("verified manifest project_version", manifest.includes(`project_version=${pkg.version}`))
ok("project truth current version", truth.includes(`**Current source version:** \`${pkg.version}\``))

ok("phase 1 doc", existsSync(join(root, "docs/PHASE-1-TRUST-BREAKERS-MEDIA-2026-11-04.md")))
ok("phase 2 doc", existsSync(join(root, "docs/PHASE-2-SOCIAL-POLISH-DISCOVER-2026-11-04.md")))
ok("phase 3 doc", existsSync(join(root, "docs/PHASE-3-COMMUNITIES-MEMBERSHIP-SHELL-2026-11-04.md")))
ok("phase 4 doc", existsSync(join(root, "docs/PHASE-4-FEED-COMPOSER-STORIES-SHELL-2026-11-04.md")))
ok("phase 5 doc", existsSync(join(root, "docs/PHASE-5-PRODUCT-UX-RELEASE-GATE-2026-11-04.md")))
ok("operator checklist", existsSync(join(root, "docs/OPERATOR_PRODUCT_UX_TESTNET_CHECKLIST_0.313.md")))

const envEx = existsSync(join(root, ".env.example"))
  ? readFileSync(join(root, ".env.example"), "utf8")
  : ""
ok("A2U fail-closed in env example", /PI_A2U_ENABLED\s*=\s*0/.test(envEx))
ok("withdrawals fail-closed in env example", /GHC_WITHDRAWALS_ENABLED\s*=\s*0/.test(envEx))

const mig = join(root, "supabase/migrations/20261104180001_gh_community_list_memberships_viewer.sql")
ok("communities memberships migration present", existsSync(mig))
ok("manifest migrations >= 178", /canonical_migrations=(\d+)/.test(manifest) && Number(RegExp.$1) >= 178)

console.log("\n--- Nested phase contracts ---")
runNested("scripts/check-phase1-trust-breakers-media-2026-11-04.mjs")
runNested("scripts/check-phase2-social-polish-discover-2026-11-04.mjs")
runNested("scripts/check-phase3-communities-membership-shell-2026-11-04.mjs")
runNested("scripts/check-phase4-feed-composer-stories-shell-2026-11-04.mjs")

console.log(`\nPhase 5 product UX release gate: ${pass}/${pass + fail} passed`)
console.log("Classification: SOURCE VERIFIED only (not DATABASE APPLIED / TESTNET VERIFIED / PRODUCTION VERIFIED)")
process.exit(fail ? 1 : 0)
