# GreenHaven product UX audit (read-only)

**Scope:** Journey inspection only — no functional rewrites in this document.  
**Product name:** Use **GreenHaven** consistently in UI copy (avoid “GH Connect” in user-facing strings).

---

## Journey map findings

| Journey step | Finding | Severity |
|--------------|---------|----------|
| First launch | Loading shell is clear; auth message text can lag | MEDIUM |
| Pi authentication | Errors improved; still depends on Browser + env | CRITICAL (ops) |
| Returning user | Onboarding flash risk mitigated by lifecycle `unknown` | HIGH if server identity not durable |
| Onboarding | Long form; worth progressive steps later | MEDIUM |
| Home / feed | Command centre + feed; cards that don’t navigate feel broken | HIGH |
| Search | Unified modal exists; results are session-local only | HIGH (expectation) |
| Discovery | Dense; filters/location not always obvious | MEDIUM |
| Profile | Social-first; professional mode now optional in data model | MEDIUM |
| Connections / matches | Multiple entry points can confuse | MEDIUM |
| Messages vs Communities | Distinction exists but group threads can look like DMs | HIGH |
| Notifications | Mixed economy vs social | MEDIUM |
| Payments | Timeout / env mismatch is critical ops issue | CRITICAL |
| Wallet | PIN → onboarding loop was a reported bug path | CRITICAL if still repro |
| GHC / marketplace | Value area needs clear “π vs GHC” copy | HIGH |
| Settings / security | Sessions & lock exist; not a single Security Center | MEDIUM |
| Logout | Must clear session + lock cleanly | HIGH |

---

## Cross-cutting issues

### CRITICAL
1. Features that look live but are **client-only** (posts, many messages) without multi-device sync  
2. Payment / Pi env misconfiguration → expired payments  
3. Identity durability → returning-user registration  

### HIGH
4. Dead or weak navigation from home cards  
5. Inconsistent “Community chat” vs “Messages” presentation  
6. Empty states that don’t say what to do next  
7. “GH Connect” residual branding in non-user strings  

### MEDIUM
8. Duplicate search helpers (`discovery-search-utils` vs universal-search) — unified ranking layer added  
9. Accessibility: focus traps in modals, alt text warnings  
10. Loading vs error recovery inconsistency  

### POLISH
11. Terminology: Pioneer / user / member  
12. Microcopy for App Lock (“device unlock” not “logged out”)  
13. Skeleton loaders on slow tabs  

---

## Prioritized UX plan (no code in audit phase)

| Priority | Action |
|----------|--------|
| CRITICAL | Prove Pi auth + payment + durable identity on production hosts |
| CRITICAL | Fix any remaining wallet PIN → onboarding redirect |
| HIGH | Wire home shortcuts only to real routes; remove dead affordances |
| HIGH | Clarify Messages vs Communities in labels and empty states |
| HIGH | Search empty state: “Searching people & communities on this device” until server search exists |
| MEDIUM | Progressive onboarding |
| MEDIUM | Security Center entry in Settings |
| POLISH | Replace remaining “GH Connect” user-visible copy with GreenHaven |

---

## Terminology standard

| Prefer | Avoid in UI |
|--------|-------------|
| GreenHaven | GH Connect, GH-CONNECT |
| Pi Browser | “the app” when Pi-specific |
| GHC | “coins” without context |
| Community | “group” when meaning Community hub |
| Messages | for DMs only |

---

*Audit only — functionality not changed by this document.*
