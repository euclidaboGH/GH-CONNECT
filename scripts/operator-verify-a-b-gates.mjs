/**
 * Operator checklist for Section A (release/env) + B (identity/auth).
 * Prints gates; exits 0 always unless --strict and a local static gate fails.
 *
 * Usage:
 *   node scripts/operator-verify-a-b-gates.mjs
 *   node scripts/operator-verify-a-b-gates.mjs --strict
 */
import { spawnSync } from "child_process"
import { existsSync } from "fs"

const strict = process.argv.includes("--strict")

const gates = [
  {
    id: "A1",
    title: "Local install + typecheck + lint + safety + build",
    cmd: "npm ci --legacy-peer-deps && npm run typecheck && npm run lint && npm run test:safety && npm run build",
    note: "Run on operator machine / CI (sandbox may OOM on npm ci)",
  },
  {
    id: "A2",
    title: "GitHub Actions CI on PR",
    note: ".github/workflows/ci.yml must run typecheck, lint, safety, verify:static, build",
  },
  {
    id: "A3-A4",
    title: "Migration reconciliation",
    cmd: "npm run ops:migration-check",
    note: "Compare VERIFIED_MANIFEST + checklist to live Supabase; do not bulk-apply",
  },
  {
    id: "A5",
    title: "Fail-closed readiness",
    note: "GET /api/health returns 503 in production when identity/session/Pi blockers present",
  },
  {
    id: "A6",
    title: "Preview vs Production env matrix",
    note: "See docs/ENV_MATRIX_PREVIEW_PRODUCTION.md — secrets only in Vercel",
  },
  {
    id: "A7",
    title: "Rollback drill",
    note: "See docs/ROLLBACK_RUNBOOK.md — last good deploy + feature flags",
  },
  {
    id: "B8",
    title: "Durable identity + sessions in production",
    note: "isPiIdentityDurable + isSessionStoreDurable; health identity_durable/session_durable",
  },
  {
    id: "B9",
    title: "Identity conflict static gate",
    cmd: "npm run test:identity-conflict",
  },
  {
    id: "B10",
    title: "Session lock + WebAuthn",
    note: "Pi Browser E2E still operator-side; static: npm run test:identity-authz",
    cmd: "npm run test:identity-authz",
  },
  {
    id: "B11",
    title: "Step-up on sensitive ops",
    note: "transfers, spend, transfer accept, withdrawals, membership activate, revoke-others",
    cmd: "npm run test:identity-authz",
  },
  {
    id: "B12",
    title: "IdentityService client trust audit",
    note: "Server resolves user via session/Pi /me — never body.ghUserId",
  },
]

console.log("=== GH-CONNECT Section A+B operator gates ===\n")
for (const g of gates) {
  console.log(`[${g.id}] ${g.title}`)
  if (g.note) console.log(`    ${g.note}`)
  if (g.cmd) console.log(`    $ ${g.cmd}`)
  console.log("")
}

if (strict) {
  const staticCmds = [
    ["test:identity-conflict", ["npm", "run", "test:identity-conflict"]],
    ["test:identity-authz", ["npm", "run", "test:identity-authz"]],
    ["ops:migration-check", ["npm", "run", "ops:migration-check"]],
  ]
  let failed = false
  for (const [name, args] of staticCmds) {
    if (!existsSync("package.json")) {
      console.error("Run from repo root")
      process.exit(1)
    }
    const r = spawnSync(args[0], args.slice(1), { stdio: "inherit", shell: process.platform === "win32" })
    if (r.status !== 0) {
      console.error(`STRICT fail: ${name}`)
      failed = true
    }
  }
  if (failed) process.exit(1)
  console.log("STRICT static gates: PASS")
}

console.log("Operator must still run full typecheck/build and Testnet identity E2E before Production.")
