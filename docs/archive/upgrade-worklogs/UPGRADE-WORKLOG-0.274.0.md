> **LEGACY VERIFICATION FIXTURE** — superseded by current package worklog; retained for audit trail only.

# Upgrade worklog — 0.274.0

## Withdrawals infrastructure health (Testnet Preview)

Added read-only `GET /api/health/withdrawals`:

- Probes Supabase connectivity, wallet authorization RPC/table, earnings withdrawable path, Pi Platform API
- Reports feature flags and config *presence* without secret values
- Explicitly does **not** evaluate per-user eligibility or initiate A2U payouts
- Cache-Control: no-store; AbortSignal timeouts on upstream calls
- Source regression: `npm run check:withdrawals-health`

Infrastructure health ≠ user withdrawal eligibility (`/api/economy/earnings/withdrawable` remains authenticated).

Source-level / source-only verification only. Supported runtime: Node.js 24.15.0.
Document date: 2026-11-01.
