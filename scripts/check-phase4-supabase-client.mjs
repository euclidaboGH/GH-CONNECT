#!/usr/bin/env node
/**
 * Phase 4 — central Supabase client adoption tracker.
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs"
import { join, relative, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const clientPath = join(root, "lib/server/supabase/rest-client.ts")

const checks = []
const ok = (name, pass, detail = "") => checks.push({ name, pass: Boolean(pass), detail })

ok("central rest-client exists", existsSync(clientPath))
if (existsSync(clientPath)) {
  const src = readFileSync(clientPath, "utf8")
  ok("exports supabaseRpc", /export async function supabaseRpc/.test(src))
  ok("exports supabaseRest", /export async function supabaseRest/.test(src))
  ok("exports getServiceSupabaseConfig", /export function getServiceSupabaseConfig/.test(src))
  ok("timeouts via AbortSignal", /AbortSignal\.timeout/.test(src))
}

// Count remaining raw /rest/v1/ outside the client module
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name === ".git") continue
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) walk(p, out)
    else if (/\.(ts|tsx|js|mjs)$/.test(name)) out.push(p)
  }
  return out
}

let raw = 0
let migratedHits = 0
const rawFiles = []
for (const file of walk(join(root, "lib"))) {
  const rel = relative(root, file)
  if (rel.includes("lib/server/supabase/rest-client")) continue
  const text = readFileSync(file, "utf8")
  const n = (text.match(/\/rest\/v1\//g) || []).length
  if (n) {
    raw += n
    rawFiles.push([n, rel])
  }
  if (/from ["']@\/lib\/server\/supabase\/rest-client["']/.test(text)) migratedHits++
}

ok("at least 3 modules import rest-client", migratedHits >= 3, `imports=${migratedHits}`)
ok("raw /rest/v1/ references tracked", true, `remaining_raw=${raw} files=${rawFiles.length}`)

// Pilot migrations must not still embed raw RPC URLs
for (const pilot of [
  "lib/server/earnings/platform-utility.ts",
  "lib/server/curation/redistribute.ts",
  "lib/server/ads/verify-store.ts",
]) {
  const text = readFileSync(join(root, pilot), "utf8")
  ok(`${pilot} uses central client`, /supabaseRpc|supabaseRest/.test(text))
  ok(`${pilot} has no inline /rest/v1/rpc`, !/\/rest\/v1\/rpc\//.test(text))
}

let failed = 0
for (const c of checks) {
  console.log(`${c.pass ? "PASS" : "FAIL"} ${c.name}${c.detail ? " — " + c.detail : ""}`)
  if (!c.pass) failed++
}
console.log(`\nPhase 4 supabase client: ${checks.length - failed}/${checks.length} passed`)
console.log(`Remaining raw /rest/v1/ references under lib/: ${raw} in ${rawFiles.length} files`)
if (failed) process.exit(1)
