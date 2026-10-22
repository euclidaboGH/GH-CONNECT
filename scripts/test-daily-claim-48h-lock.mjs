import { readFileSync, existsSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const read = (p) => existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : ""
let passed = 0, failed = 0
function check(ok, name) { if (ok) { passed++; console.log(`✓ ${name}`) } else { failed++; console.error(`✗ ${name}`) } }
const migration = read("supabase/migrations/20261022010076_daily_claim_48h_lock.sql")
const issuancePolicy = read("supabase/migrations/20261022010077_ghc_daily_claim_only_issuance.sql")
const daily = read("app/api/economy/rewards/daily/route.ts")
const claimRoute = read("app/api/economy/rewards/claim/route.ts")
const store = read("lib/server/economy/store.ts")
const ui = read("components/ghc/daily-reward-experience.tsx")
const db = read("lib/server/economy/db.ts")
check(migration.includes("uq_ghc_daily_claim_pending_ref"), "pending daily claim has unique idempotency index")
check(/p_user_amount,\s*'pending'/.test(migration), "daily claim writes pending, not posted, user reward")
check(migration.includes("now() + interval '48 hours'"), "server derives redemption time from database clock")
check(migration.includes("v_pending.created_at + interval '48 hours'"), "redemption enforces 48-hour lock in SQL")
check(migration.includes("NOT_YET_REDEEMABLE"), "early redemption returns explicit locked state")
check(migration.includes("IF COALESCE(v_pending.source_event, '') = 'DAILY_CLAIM_V12'"), "48-hour timing is derived from the Daily Claim source event")
check(issuancePolicy.includes("GHC_ISSUANCE_POLICY_VIOLATION"), "Phase 6 policy blocks redemption of non-Daily-Claim positive credits")
check(migration.includes("status = 'expired' AND source_event = 'DAILY_CLAIM_V12'"), "retries after successful redemption resolve idempotently")
check(daily.includes("atomic.pending !== true || !atomic.redeemableAt"), "daily API fails closed until the 48-hour migration contract is active")
check(daily.includes("pending: true") && daily.includes("redeemableAt: atomic.redeemableAt"), "daily API exposes pending state and redemption timestamp")
check(claimRoute.includes('code === "NOT_YET_REDEEMABLE" ? 409'), "API returns conflict status before eligibility")
check(store.includes('pending.sourceEvent !== "DAILY_CLAIM_V12"') && store.includes("48 * 60 * 60 * 1000"), "local store rejects non-Daily-Claim redemption and enforces 48-hour lock")
check(ui.includes("claimed and pending for 48 hours") && ui.includes("redeemableAt: server.redeemableAt"), "UI explains pending reward and timestamp")
check(db.includes("redeemableAt?: string") && db.includes("pending?: boolean"), "database result contract includes pending lifecycle")
console.log(`\nDaily Claim 48-hour lock checks: ${passed} passed, ${failed} failed`)
if (failed) process.exit(1)
