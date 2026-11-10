#!/usr/bin/env node
/** Source-only route inventory. Heuristic flags are review leads, not proof of security coverage. */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
const root = process.cwd(), apiRoot = join(root, 'app/api'), docsDir = join(root, 'docs')
const files = []
function walk(dir) { for (const e of readdirSync(dir, { withFileTypes: true })) { const p = join(dir, e.name); if (e.isDirectory()) walk(p); else if (e.isFile() && e.name === 'route.ts') files.push(p) } }
walk(apiRoot); files.sort()
const patterns = {
  auth: /resolveAuthenticatedUser\(|requireGhSession\(|requireAccountSecurityContext\(|requireAdmin|requireOperator|requireServiceRole/i,
  sessionGate: /requireGhSession\(|requireAccountSecurityContext\(/,
  rateLimit: /checkDurableRateLimit\(|checkRateLimit\(/,
  boundedBody: /readBoundedJson\(/,
  idempotency: /idempotencyKey|idempotency_key|clientRequestId/i,
  bodyIdentity: /(?:body|json|payload|input)\.(?:userId|ghUserId|ownerId|senderId|fromUserId|actorUserId|recipientUserId)/,
  noStore: /Cache-Control['"]?\s*:\s*['"]no-store|cache:\s*['"]no-store/,
  webhookSignals: /webhook|signature|callback/i,
}
const rows = files.map(file => {
  const source = readFileSync(file, 'utf8'), route = relative(root, file).split(sep).join('/')
  const methods = [...source.matchAll(/export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\b/g)].map(m => m[1])
  const flags = Object.fromEntries(Object.entries(patterns).map(([k, re]) => [k, re.test(source)]))
  const likelySensitive = /\/(?:economy|payments|membership|wallet|auth|operator)\//i.test('/' + route) && !/\/(?:health|catalog|policy|supply|public)\//i.test('/' + route)
  return { route, methods: [...new Set(methods)].join(';'), ...flags, likelySensitive, authSource: flags.auth ? 'AUTH_OR_PRIVILEGE_HELPER_PRESENT' : 'NO_MATCHING_AUTH_HELPER_TOKEN' }
})
const totals = {
  routes: rows.length,
  authOrPrivilegeHelper: rows.filter(r => r.auth).length,
  sessionGradeHelper: rows.filter(r => r.sessionGate).length,
  rateLimitHelper: rows.filter(r => r.rateLimit).length,
  boundedBodyHelper: rows.filter(r => r.boundedBody).length,
  idempotencyMarkers: rows.filter(r => r.idempotency).length,
  bodyIdentityMarkers: rows.filter(r => r.bodyIdentity).length,
  noStoreMarkers: rows.filter(r => r.noStore).length,
  likelySensitiveWithoutMatchingAuth: rows.filter(r => r.likelySensitive && !r.auth).length,
  webhookOrCallbackSignals: rows.filter(r => r.webhookSignals).length,
}
const fields = ['route','methods','auth','sessionGate','rateLimit','boundedBody','idempotency','bodyIdentity','noStore','likelySensitive','webhookSignals','authSource']
const esc = v => `"${String(v ?? '').replaceAll('"','""')}"`
const csv = [fields.join(','), ...rows.map(r => fields.map(f => esc(typeof r[f] === 'boolean' ? (r[f] ? 'yes' : 'no') : r[f])).join(','))].join('\n') + '\n'
mkdirSync(docsDir, { recursive: true })
writeFileSync(join(docsDir, 'PHASE-3-API-ARCHITECTURE-INVENTORY-2026-11-09.csv'), csv)
const queue = rows.filter(r => r.likelySensitive && !r.auth).map(r => `- [0m${r.route}[0m (${r.methods || 'no exported method detected'})`.replaceAll('\u001b[0m','`'))
const identityQueue = rows.filter(r => r.bodyIdentity).map(r => `- [0m${r.route}[0m`.replaceAll('\u001b[0m','`'))
const report = `# Phase 3 — Architecture, Identity & Durable Operation Boundaries

**Baseline:** [0mgh-connect@0.338.13[0m  
**Generated:** 2026-11-09  
**Status:** Source inventory generated; manual authorization classification, integration tests and live-environment evidence remain open.

## Scope and method

A deterministic dependency-free lexical scanner inventories [0mapp/api/**/route.ts[0m. It records HTTP methods and textual signals for authentication/privilege helpers, session-grade gates, rate limiting, bounded request bodies, idempotency, request-body identity fields, no-store behavior and webhook/callbacks. It does not parse TypeScript ASTs, prove authorization, inspect runtime control flow, contact Pi/Supabase, or validate remote database state. Missing text is not proof of a defect; present text is not proof every path is protected.

## Inventory totals

| Signal | Routes with signal |
|---|---:|
${Object.entries(totals).map(([k,v]) => `| ${k} | ${v} |`).join('\n')}

Full per-route inventory: [0mdocs/PHASE-3-API-ARCHITECTURE-INVENTORY-2026-11-09.csv[0m.

## Manual review queues

### Sensitive-path routes with no matching auth/privilege-helper token

These are triage candidates only, not confirmed defects. Review handler control flow, middleware, signature validation, public status and privileged-operation behavior before changing code:

${queue.length ? queue.join('\n') : '- None detected by this heuristic.'}

### Routes with request-body identity-like fields

Fields may represent legitimate targets or dangerous caller identity overrides. Confirm actor identity comes from server auth and target identity is independently authorized:

${identityQueue.join('\n') || '- None detected.'}

## Required architecture invariants

1. **Canonical actor identity:** writes derive the acting GH user from verified session/token mapping, never a caller-supplied actor ID. Target IDs must be separately authorized.
2. **Session-grade actions:** account security, session management, privilege elevation and sensitive recovery require valid "gh_session" and durable session/step-up state where policy demands it. Pi bearer bootstrap alone is not a durable session.
3. **Durable writes:** financial, wallet, membership and marketplace transitions use database-enforced transactions/RPCs or equivalent atomic primitives.
4. **Idempotency:** keys bind to actor and operation payload; mismatched reuse returns a stable conflict.
5. **Fail closed:** unavailable identity mappings, durable session stores, rate-limit controls, ledger snapshots or payment adapters must not silently authorize sensitive writes.
6. **Input/cache/CSRF controls:** bounded schemas, appropriate no-store responses and CSRF protection complement but do not replace authorization.
7. **Environment separation:** source checks do not establish Testnet/Mainnet schema parity, RLS, transaction behavior, Pi API acceptance or deployment configuration.

## Existing source checks executed

- "scripts/check-phase2-architecture-identity-2026-11-04.mjs" — **20/20 PASS**.
- "scripts/check-phase4-identity-authentication.mjs" — **16/16 PASS**.
- "scripts/check-phase2-wallet-authorization.mjs" — **27/27 PASS**.
- "scripts/check-phase2-transfer-request-idempotency-intent.mjs" — **11/11 PASS**.

These are source-contract checks, not full integration/live tests. Runtime used Node "v22.16.0"; the repository baseline pins Node 24, so full verification must be rerun with the approved Node 24 runtime.

## Phase 3 completion gates

- [ ] Manually classify every sensitive-path triage candidate and body identity field.
- [ ] Trace identity from Pi "/v2/me" through "gh_pi_identities" and "gh_sessions" to sensitive route decisions.
- [ ] Test stale/invalid cookie plus bearer fallback, account switching, revoked sessions, multi-instance concurrency and identity-store outages.
- [ ] Exercise idempotent financial writes under duplicate requests, payload mismatch, concurrent races, timeout-after-commit and retry-after-restart.
- [ ] Run typecheck, lint and production verification under Node 24.15.0 (or repository-approved Node 24).
- [ ] Obtain separate read-only Testnet and Mainnet evidence; neither environment is verified by this report.

**Change policy:** this increment adds an auditable source inventory and one narrow route hardening: session revocation now delegates to the existing centralized account-security gate, which enforces durable session storage in production as well as a valid gh_session. Recent step-up, rate limiting, and revocation ordering remain in place. No schema, migration, dependency version, or production setting changed.
`
writeFileSync(join(docsDir, 'PHASE-3-ARCHITECTURE-IDENTITY-OPERATIONS-2026-11-09.md'), report.replaceAll('\u001b[0m','`'))
console.log(`Phase 3 API architecture inventory: ${rows.length} routes scanned`)
for (const [key,value] of Object.entries(totals)) console.log(`${key}: ${value}`)
console.log('Wrote Phase 3 route inventory CSV and audit report.')
