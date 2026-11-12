import fs from "node:fs"
const control = fs.readFileSync("lib/server/security/control-plane.ts", "utf8")
const migration = fs.readFileSync("supabase/migrations/20261101010001_gh_security_control_plane_retention.sql", "utf8")
const contract = fs.readFileSync("lib/server/security/rate-limit-contract.ts", "utf8")
const failures = []
if (!control.includes("assertDurableRateLimitInput(key, limit, windowMs)")) failures.push("durable limiter must validate inputs through the tested contract")
if (!contract.includes("windowMs < 1_000 || windowMs > 86_400_000")) failures.push("durable limiter contract must enforce SQL window bounds")
if (!control.includes("parseDurableRateLimitResult(result)") || !contract.includes("Number.isSafeInteger(result.remaining)") || !contract.includes("Number.isSafeInteger(result.retryAfterSec)")) failures.push("RPC result fields must be validated before acceptance")
if (!control.includes('90 * 24 * 60 * 60 * 1000')) failures.push("new security events must receive a bounded default retention")
if (!migration.includes('LIMIT 500') || !migration.includes("interval '2 days'")) failures.push("rate-limit cleanup must be bounded and retain expired buckets past the maximum window")
if (!migration.includes('expires_at IS NOT NULL AND expires_at <= v_now')) failures.push("expired security event cleanup is missing")
if (!migration.includes('REVOKE ALL ON FUNCTION public.gh_security_rate_limit_consume') || !migration.includes('TO service_role')) failures.push("service-role-only RPC ACL must be preserved")
if (failures.length) { console.error(`Pass 45 security retention: ${failures.length} failure(s)`); for (const f of failures) console.error(` - ${f}`); process.exit(1) }
console.log("Pass 45 security retention: PASS (bounded cleanup, 90-day event TTL, strict RPC validation, service-role ACL)")
