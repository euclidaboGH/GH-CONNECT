/**
 * Phase 1–25 hardening audit — static invariants for production readiness.
 * Does not replace live Supabase/Pi verification.
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const read = (p) => fs.readFileSync(path.join(root, p), "utf8")
const exists = (p) => fs.existsSync(path.join(root, p))

const checks = []
const row = (name, ok, detail = "") => {
  checks.push({ name, ok: Boolean(ok), detail })
  console.log(ok ? "PASS" : "FAIL", name, detail || "")
}

const rpc = read("lib/server/social/rpc.ts")
const demo = read("lib/demo-data-policy.ts")
const postSync = read("lib/social/post-sync.ts")
const client = read("lib/social/client.ts")
const curation = read("app/api/social/posts/[id]/curation/route.ts")
const comments = read("app/api/social/posts/[id]/comments/route.ts")
const authority = exists("lib/architecture/authority.ts") ? read("lib/architecture/authority.ts") : ""

row("service-role social RPC only", /supabaseServiceRoleKey/.test(rpc) && /Content-Profile/.test(rpc))
row("no silent historical RPC fallbacks (Phase 39)", /no longer probes historical/.test(rpc) || !/builtIn\.push/.test(rpc))
row("demo data blocked in production by default", /NODE_ENV === "production"/.test(demo) || /return false/.test(demo))
row("post-sync contract versioned", /version: 1/.test(postSync) && /POST_SYNC_EVENT/.test(postSync))
row("curation emits engagement post-sync from client", /broadcastPostSync/.test(client) && /operation: "engagement"/.test(client))
row("self-curation forbidden path", /SELF_CURATION_FORBIDDEN/.test(curation))
row("comment author from session only", /authorId:\s*auth\.userId/.test(comments) && /void body\.authorId/.test(comments))
row("package release marker present", exists("lib/app-release.ts") && /APP_RELEASE_VERSION/.test(read("lib/app-release.ts")))
row("identity domain present", exists("lib/domains/greenhaven-id.ts"))
row("wallet read seam present", exists("lib/domains/adapters/wallet-read-seam.ts"))
row("correlation/post-sync architecture present", exists("lib/social/post-sync.ts"))
row("production authority module present", exists("lib/architecture/authority.ts") || exists("lib/architecture/trust-authority.ts"))

const failed = checks.filter((c) => !c.ok)
console.log(`\n${checks.length - failed.length}/${checks.length} passed`)
if (failed.length) process.exit(1)
