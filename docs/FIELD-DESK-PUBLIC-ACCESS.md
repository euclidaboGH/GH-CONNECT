# Field Research — public surveys / elections observation / situation reports

## Purpose
A **public, all-browser** surface (`/field`) for field agents and civic partners who may not have Pi Browser or a Pi account. Same reachability model as Privacy / Terms / Support.

## What it is not
- Not GreenHaven login
- Not Pi wallet / economy / messaging graph access
- Not a substitute for authenticated admin consoles

## Access model (10 codes)
Configure **up to 10** shared access codes:

```bash
# Preferred: SHA-256 hex digests (comma-separated, max 10)
GHC_FIELD_ACCESS_CODE_HASHES=hex1,hex2,...

# Or plaintext codes (min 4 characters) hashed at runtime — ops convenience only
GHC_FIELD_ACCESS_CODES=1000,2000,3000,4000,5000,6000,7000,8000,9000,10000

# Required: ≥32-byte secret for field session HMAC (dedicated secret preferred)
GHC_FIELD_SESSION_SECRET=<openssl rand -base64 48>

# Optional: GH user id that owns the central inbox (for future durable routing)
GHC_FIELD_ADMIN_USER_ID=<uuid-or-gh-user-id>

# Optional: custom surveys JSON
GHC_FIELD_SURVEYS_JSON=[{"id":"...","title":"...","questions":[{"id":"...","prompt":"..."}]}]
```

Generate a digest: `echo -n 'your-code' | openssl dgst -sha256`

## Session scope
- Cookie: `gh_field_session` (HttpOnly, SameSite=Lax, 12h)
- Agents may also send `Authorization: Field <token>`
- Authorizes **only** `/api/field/*`

## APIs
| Method | Path | Auth |
|--------|------|------|
| POST | `/api/field/unlock` | Access code |
| GET/DELETE | `/api/field/session` | Cookie |
| POST | `/api/field/report` | Field session |
| GET | `/api/field/surveys` | Field session |
| GET | `/api/field/admin/reports` | `x-ghc-operator-key` |

## Durability
- Proposal SQL: `supabase/proposals/20261116160000_gh_field_reports.sql`
- Applied to GH Connect Testnet as migration `20261116170409_gh_field_reports_public_intake.sql`. Preview must run the matching migration before it can provide multi-instance durable reports; without database configuration the current development fallback is process-local only.

## Security controls
- Rate limits on unlock and report
- Text body max 4000 chars; no file uploads
- Timing-safe code compare; HMAC session tokens
- Operator admin list requires reconcile key


See `docs/FIELD-RESEARCH-PLATFORM-UPGRADE-PLAN.md` for the product architecture and the 30-track upgrade plans for Field Research, Challenge-on-Post, and Polls-on-Post. The current Field Research intake is text-only; media uploads and owner-created public forms are planned capabilities, not shipped functionality.
