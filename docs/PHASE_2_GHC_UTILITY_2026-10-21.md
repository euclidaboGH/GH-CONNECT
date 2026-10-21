# Phase 2 — GHC utility sinks & supply transparency (0.66.0)

## Goals

- Real reasons to spend GHC (boosts, tools)
- Transparent server catalog prices
- Issuance caps visible to operators/users
- Spends debit available balance only (no client amounts)

## Catalog purposes (utility)

| Purpose | GHC | Dual π (independent) | Duration |
|---------|-----|----------------------|----------|
| boost_post | 11 | 0.15 | 24h |
| boost_profile | 16.5 | 0.22 | 24h |
| boost_listing | 13.2 | 0.18 | 48h |
| feed_spotlight | 27.5 | 0.35 | 12h |
| community_tools_month | 40 | 0.5 | 30d |
| creator_studio_day | 8 | 0.1 | 24h |

(Boost amounts include 10% fee on base.)

## APIs

- `GET /api/economy/catalog` — full or `?utility=1`
- `GET /api/economy/supply` — caps, population, process telemetry
- `POST /api/economy/utility` — `{ purpose, targetId? }` → durable spend

## Wallet

Tools → **Spend GHC** opens utility panel with live catalog + buy buttons.

## Economic discipline

- Activity daily/weekly caps unchanged
- Daily claim remains primary issuance path
- Sinks recorded in process telemetry (`sink_boost`)
- Ranking may honor active boosts when target id provided; spend is authoritative either way

## Phase 3 next

Acquisition review for π packs at scale; funded GHC→π settlement remains gated.
