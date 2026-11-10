#!/usr/bin/env node
/**
 * Notification RPCs must be service_role-only in migrations (SECURITY DEFINER).
 */
import { readFileSync, existsSync, readdirSync } from "node:fs"
import { join } from "node:path"

const root = process.cwd()
const migDir = join(root, "supabase/migrations")
const checks = []
const test = (n, ok) => {
  checks.push(!!ok)
  console.log(`${ok ? "PASS" : "FAIL"} ${n}`)
}

const name = "20261101160001_harden_notification_rpc_execute_privileges.sql"
const path = join(migDir, name)
test("privilege harden migration exists", existsSync(path))
if (!existsSync(path)) process.exit(1)

const sql = readFileSync(path, "utf8")
const targets = [
  "gh_notification_inbox_list",
  "gh_notification_inbox_unread_count",
  "gh_notification_inbox_mark_read",
  "gh_social_notifications_list",
  "gh_social_notifications_unread_count",
  "gh_social_notifications_mark_read",
  "gh_social_notification_create",
]
for (const fn of targets) {
  test(
    `revokes PUBLIC/anon/authenticated on ${fn}`,
    new RegExp(`REVOKE ALL ON FUNCTION public\\.${fn}[\\s\\S]*?FROM PUBLIC, anon, authenticated`).test(sql),
  )
  test(
    `grants service_role on ${fn}`,
    new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${fn}[\\s\\S]*?TO service_role`).test(sql),
  )
}
test("privilege-only (no CREATE OR REPLACE body rewrite)", !/CREATE OR REPLACE FUNCTION/.test(sql))
test("does not touch wallet/payout/earnings", !/wallet_authorization|fee_bps|gh_earnings|a2u/i.test(sql))

// Ensure fix migration also revokes social list
const fix = readFileSync(join(migDir, "20261101150001_fix_notification_list_createdAt_order.sql"), "utf8")
test(
  "ORDER BY fix migration also revokes anon/authenticated on social list",
  /REVOKE ALL ON FUNCTION public\.gh_social_notifications_list[\s\S]*FROM PUBLIC, anon, authenticated/.test(fix),
)

const failed = checks.filter((x) => !x).length
console.log(`\nNotification RPC privileges: ${checks.length - failed}/${checks.length} passed`)
process.exit(failed ? 1 : 0)
