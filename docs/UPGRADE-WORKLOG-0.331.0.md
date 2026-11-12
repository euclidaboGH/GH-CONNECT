# UPGRADE WORKLOG 0.331.0

## Phase 4 Identity & Authentication

- SESSION_MAX_ACTIVE_PER_USER = 8 with oldest-first revocation on create
- rotateSession after successful Pi step-up; HttpOnly cookie re-issued
- lib/server/identity/auth-integrity.ts (requireGhSession / durable store)
- Source gate scripts/check-phase4-identity-authentication.mjs in prebuild

Source-only verification. Live durable session store and Pi Browser acceptance remain operator-owned. Production NOT APPROVED. Node.js 24.15.0 supported runtime.
