# Phase 5 — Discover / Match durability

- Table/RPC proposal: supabase/migrations/20261017_match_signals_durable.sql
- POST /api/matching/signal, GET /api/matching/inbox
- swipe dual-writes like/pass/superlike; mutual from server
- Hydrate likes + matches when durable
- Match ≠ Friend (unchanged product rule)
