#!/usr/bin/env node
/**
 * Operator live multi-user E2E smoke against a deployed base URL.
 *
 * Env:
 *   GHC_E2E_BASE_URL          required (e.g. https://your-app.vercel.app)
 *   GHC_E2E_COOKIE_A          optional session cookie for user A
 *   GHC_E2E_COOKIE_B          optional session cookie for user B
 *   GHC_E2E_AUTH_A            optional Authorization header value for A
 *   GHC_E2E_AUTH_B            optional Authorization header value for B
 *
 * Without cookies/auth: only public/health probes run (partial gate).
 * With one user: authenticated single-user probes.
 * With two users: cross-user isolation + dual inbox probes (best effort).
 *
 * Never invents financial outcomes. Does not mint GHC.
 */
import { requireE2eBaseUrl } from "../lib/e2e/resolve-base-url.mjs"
const resolved = requireE2eBaseUrl(process.env)
const base = resolved.baseUrl

const cookieA = process.env.GHC_E2E_COOKIE_A || ""
const cookieB = process.env.GHC_E2E_COOKIE_B || ""
const authA = process.env.GHC_E2E_AUTH_A || ""
const authB = process.env.GHC_E2E_AUTH_B || ""

let passed = 0
let failed = 0
let skipped = 0

function ok(msg) {
  passed++
  console.log("  ✓", msg)
}
function fail(msg) {
  failed++
  console.error("  ✗", msg)
}
function skip(msg) {
  skipped++
  console.log("  ○", msg)
}

async function req(path, { method = "GET", cookie = "", auth = "", body } = {}) {
  const headers = { Accept: "application/json" }
  if (cookie) headers.Cookie = cookie
  if (auth) headers.Authorization = auth
  if (body !== undefined) {
    headers["Content-Type"] = "application/json"
  }
  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    redirect: "manual",
  })
  const text = await res.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    /* */
  }
  return { status: res.status, json, text: text.slice(0, 200) }
}

function headersFor(user) {
  if (user === "A") return { cookie: cookieA, auth: authA }
  return { cookie: cookieB, auth: authB }
}

function hasCreds(user) {
  const h = headersFor(user)
  return Boolean(h.cookie || h.auth)
}

console.log(`
GH-CONNECT operator live E2E
============================
Base: ${base}\nTarget: ${resolved.isLocal ? "local" : resolved.isProdTarget ? "production" : "preview/other"}
User A creds: ${hasCreds("A") ? "yes" : "no"}
User B creds: ${hasCreds("B") ? "yes" : "no"}
`)

// --- Public / health ---
{
  console.log("1) Health / readiness")
  try {
    const r = await req("/api/health")
    if (r.status === 200 || r.status === 503) {
      ok(`GET /api/health → ${r.status} status=${r.json?.status || "?"}`)
      if (r.json?.schemaReadiness) {
        const sr = r.json.schemaReadiness
        console.log("     schema:", JSON.stringify(sr))
      }
    } else {
      fail(`GET /api/health unexpected ${r.status}`)
    }
  } catch (e) {
    fail(`GET /api/health network: ${e.message}`)
  }
}

// --- Public lists ---
{
  console.log("\n2) Public social surfaces (no invent)")
  try {
    const r = await req("/api/communities?limit=5")
    if (r.status === 200 && r.json) {
      ok(`GET /api/communities ok durable=${r.json.durable} count=${(r.json.communities || []).length}`)
    } else if (r.status === 401) {
      ok("GET /api/communities requires auth (acceptable)")
    } else {
      fail(`GET /api/communities → ${r.status}`)
    }
  } catch (e) {
    fail(`communities: ${e.message}`)
  }

  try {
    const r = await req("/api/marketplace/listings?scope=public&limit=5")
    if (r.status === 200 && r.json) {
      ok(`GET /api/marketplace/listings public durable=${r.json.durable} count=${(r.json.listings || []).length}`)
    } else {
      fail(`GET /api/marketplace/listings → ${r.status}`)
    }
  } catch (e) {
    fail(`marketplace: ${e.message}`)
  }
}

// --- Single user auth probes ---
async function userProbes(label) {
  if (!hasCreds(label)) {
    skip(`${label}: no credentials — skip authenticated probes`)
    return
  }
  console.log(`\n3) Authenticated probes (${label})`)
  const h = headersFor(label)

  const paths = [
    ["/api/profile/me", "GET"],
    ["/api/connections/request", "GET"],
    ["/api/matching/inbox", "GET"],
    ["/api/social/notifications?limit=10", "GET"],
    ["/api/social/notifications?countOnly=1", "GET"],
  ]

  for (const [path, method] of paths) {
    try {
      const r = await req(path, { method, ...h })
      if (r.status === 200 && r.json?.ok !== false) {
        ok(`${label} ${method} ${path} → ${r.status}`)
      } else if (r.status === 401) {
        fail(`${label} ${method} ${path} → 401 (credentials rejected)`)
      } else if (r.status === 503) {
        ok(`${label} ${method} ${path} → 503 (DB not durable — expected pre-migration)`)
      } else {
        fail(`${label} ${method} ${path} → ${r.status} ${r.json?.error || r.text}`)
      }
    } catch (e) {
      fail(`${label} ${path}: ${e.message}`)
    }
  }
}

await userProbes("A")
await userProbes("B")

// --- Two-user isolation best effort ---
{
  console.log("\n4) Two-user isolation")
  if (!hasCreds("A") || !hasCreds("B")) {
    skip("Need both GHC_E2E_COOKIE_A/B or AUTH_A/B for isolation checks")
  } else {
    try {
      const a = await req("/api/profile/me", headersFor("A"))
      const b = await req("/api/profile/me", headersFor("B"))
      const idA = a.json?.profile?.id || a.json?.profile?.ghUserId
      const idB = b.json?.profile?.id || b.json?.profile?.ghUserId
      if (idA && idB && String(idA) !== String(idB)) {
        ok(`Distinct profile identities A=${String(idA).slice(0, 12)}… B=${String(idB).slice(0, 12)}…`)
      } else if (a.status === 200 && b.status === 200) {
        fail("Could not confirm distinct user ids from /api/profile/me")
      } else {
        skip("Profile me not durable enough to compare ids")
      }
    } catch (e) {
      fail(`isolation: ${e.message}`)
    }

    try {
      const aIn = await req("/api/connections/request", headersFor("A"))
      const bIn = await req("/api/connections/request", headersFor("B"))
      if (aIn.status === 200 && bIn.status === 200) {
        ok("Both users can load connection inbox independently")
      } else {
        fail(`Connection inbox A=${aIn.status} B=${bIn.status}`)
      }
    } catch (e) {
      fail(`connection dual: ${e.message}`)
    }
  }
}

console.log(`
----------------------------
passed=${passed} failed=${failed} skipped=${skipped}
`)

if (failed > 0) process.exit(1)
if (!hasCreds("A") && !hasCreds("B")) {
  console.log("PARTIAL: health + public only. Provide user cookies for full gate.")
  process.exit(0)
}
process.exit(0)
