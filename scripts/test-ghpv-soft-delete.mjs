#!/usr/bin/env node
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
let pass = 0, fail = 0
function ok(c, m) { if (c) { pass++; console.log("  ✓", m) } else { fail++; console.log("  ✗", m) } }

const mig = fs.readFileSync(path.join(root, "supabase/migrations/20261020_ghpv_soft_delete_atomic.sql"), "utf8")
ok(mig.includes("gh_post_soft_delete"), "replaces soft delete")
ok(mig.includes("gh_ghpv_cleanup_deleted_content"), "calls cleanup in same function")
ok(mig.includes("v_author <> trim(p_actor_id)"), "owner check")
ok(mig.includes("FOR UPDATE"), "row lock")
ok(mig.includes("alreadyDeleted"), "repeat delete idempotent")
ok(!/ghc_execute/.test(mig), "no ledger")
ok(mig.includes("REVOKE ALL") && mig.includes("service_role"), "service_role only")

const route = fs.readFileSync(path.join(root, "app/api/social/posts/[id]/route.ts"), "utf8")
ok(route.includes("resolveAuthenticatedUser"), "delete requires session")
ok(route.includes("p_actor_id: auth.userId"), "actor from session")
ok(!route.includes("gh_ghpv_cleanup_deleted_content"), "client route does not call cleanup directly")

const settle = fs.readFileSync(path.join(root, "app/api/social/posts/[id]/ghpv/settle/route.ts"), "utf8")
ok(settle.includes("GH_SETTLEMENT_INTERNAL_KEY"), "server env key")
ok(!settle.includes("NEXT_PUBLIC_"), "key not public prefix")
ok(!/console\.(log|error|info).*key/i.test(settle), "does not log key")
ok(settle.includes("timingSafeEqual"), "constant time")
ok(settle.includes("SETTLEMENT_DISABLED"), "missing key fail closed")

const snap = fs.readFileSync(path.join(root, "supabase/migrations/20261017_ghpv_settlement_engine.sql"), "utf8")
ok(snap.includes("deleted_at IS NULL"), "deleted posts excluded from snapshot")

console.log(`\nGHPV soft-delete: ${pass} pass, ${fail} fail`)
process.exit(fail ? 1 : 0)
