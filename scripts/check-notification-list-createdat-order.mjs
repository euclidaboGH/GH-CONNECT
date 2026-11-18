#!/usr/bin/env node
/**
 * Regression: notification list RPCs must not ORDER BY nonexistent q.created_at
 * when the subquery exposes "createdAt".
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

const fixName = "20261101150001_fix_notification_list_createdAt_order.sql"
const fixPath = join(migDir, fixName)
test("fix migration exists", existsSync(fixPath))

if (!existsSync(fixPath)) {
  process.exit(1)
}

const fix = readFileSync(fixPath, "utf8")

test("replaces gh_notification_inbox_list", /CREATE OR REPLACE FUNCTION public\.gh_notification_inbox_list\(/.test(fix))
test("replaces gh_social_notifications_list", /CREATE OR REPLACE FUNCTION public\.gh_social_notifications_list\(/.test(fix))
test("inbox outer order uses quoted createdAt", /ORDER BY q\."createdAt" DESC,\s*q\.id DESC/.test(fix))
test("social outer order uses quoted createdAt", /ORDER BY q\."createdAt" DESC/.test(fix))
test("inbox preserves JSON createdAt alias", /n\.created_at AS "createdAt"/.test(fix))
test("social preserves epoch createdAt alias", /AS "createdAt"/.test(fix) && /extract\(epoch from n\.created_at\)/.test(fix))
test("fix function bodies do not ORDER BY bare q.created_at", !/ORDER BY q\.created_at/.test(fix) && !/ORDER BY q\.created_at DESC/.test(fix))
test("preserves SECURITY DEFINER", (fix.match(/SECURITY DEFINER/g) || []).length >= 2)
test("grants execute only to service_role for inbox", /GRANT EXECUTE ON FUNCTION public\.gh_notification_inbox_list[\s\S]*TO service_role/.test(fix))
test("grants execute only to service_role for social", /GRANT EXECUTE ON FUNCTION public\.gh_social_notifications_list[\s\S]*TO service_role/.test(fix))
test("revokes anon/authenticated on both", /REVOKE ALL ON FUNCTION public\.gh_notification_inbox_list[\s\S]*anon, authenticated/.test(fix) && /REVOKE ALL ON FUNCTION public\.gh_social_notifications_list[\s\S]*anon, authenticated/.test(fix))
test("does not touch transfer or wallet authorization", !/ghc_create_transfer_request/.test(fix) && !/gh_pi_wallet_authorization/.test(fix) && !/fee_bps/.test(fix))
test("does not mutate notification tables", !/UPDATE public\.gh_notification/.test(fix) && !/DELETE FROM public\.gh_/.test(fix))

// Historical sources still contain the bug string; the fix migration must be the latest replace.
const allSql = readdirSync(migDir)
  .filter((f) => f.endsWith(".sql"))
  .sort()
const later = allSql.filter((f) => f > fixName)
test("no later migration reintroduces bare q.created_at on these functions", (() => {
  for (const f of later) {
    const t = readFileSync(join(migDir, f), "utf8")
    if (/gh_notification_inbox_list|gh_social_notifications_list/.test(t) && /\bq\.created_at\b/.test(t)) {
      return false
    }
  }
  return true
})())

const failed = checks.filter((x) => !x).length
console.log(`\nNotification list createdAt order: ${checks.length - failed}/${checks.length} passed`)
process.exit(failed ? 1 : 0)
