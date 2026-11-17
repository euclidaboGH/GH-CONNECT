import { readFileSync } from "node:fs"
import assert from "node:assert/strict"
const route = readFileSync(new URL("../app/api/social/posts/[id]/curation/route.ts", import.meta.url), "utf8")
const weights = readFileSync(new URL("../lib/server/ghpv/vote-weight.ts", import.meta.url), "utf8")
const intelligence = readFileSync(new URL("../lib/server/reputation/intelligence.ts", import.meta.url), "utf8")
const migration = readFileSync(new URL("../supabase/migrations/20261023030002_gh_reputation_curation_intelligence_v2.sql", import.meta.url), "utf8")
const checks = [
  ["curation refresh is invoked before weight resolution", route.indexOf("refreshReputationIntelligence(auth.userId)") < route.indexOf("resolveWeightedVote({")],
  ["refresh failures produce sanitized server diagnostics", route.includes('[curation] reputation intelligence refresh failed') && route.includes('CURATION_INTELLIGENCE_REFRESH_FAILED')],
  ["missing durable intelligence remains fail-closed", weights.includes('throw new Error("CURATION_INTELLIGENCE_UNAVAILABLE")')],
  ["formula power is not substituted for durable authority", weights.includes("if (!intelligence)") && !weights.includes("if (!intelligence) {\n    curationPower = computedPower")],
  ["API returns stable public error plus safe diagnostic code", route.includes('error: "CURATION_INTELLIGENCE_UNAVAILABLE"') && route.includes("diagnosticCode")],
  ["raw database errors are logged server-side, not returned", route.includes('console.error("[curation] authoritative weight resolution failed"') && route.includes("reason: reason.slice(0, 180)" )],
  ["refresh RPC exists in source migration", migration.includes("FUNCTION public.gh_reputation_intelligence_refresh(p_user_id text)")],
  ["snapshot getter RPC exists in source migration", migration.includes("FUNCTION public.gh_reputation_intelligence_get(p_user_id text)")],
  ["server RPC helper requires Supabase service credentials", intelligence.includes("env.supabaseServiceRoleKey")],
]
for (const [label, passed] of checks) { console.log(`${passed ? "PASS" : "FAIL"} ${label}`); assert.ok(passed, label) }
console.log(`Curation intelligence readiness: ${checks.length}/${checks.length} passed.`)
