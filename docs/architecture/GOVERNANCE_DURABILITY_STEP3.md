# Governance durability (Step 3)

## Status

| Layer | State |
|-------|--------|
| Governance logic (roles, health, lifecycle) | Production-ready logic |
| Session log/report Maps | Class C — process memory |
| Server API mirror | `/api/governance/*` — honest `durable: false` until migration + insert |
| DB migration | `20260907_community_governance_log_proposal.sql` — **NOT APPLIED** |

## Rules

1. Never set `durable: true` unless a server confirmed persistence.
2. Session log remains available for Studio admin UX.
3. UI should surface `governanceDurabilityLabel()` for moderators.
4. No GHC/Pi tables touched.

## Env

- `GHC_GOVERNANCE_SERVER=1` — enable server mirror attempts (still not durable without migration)
