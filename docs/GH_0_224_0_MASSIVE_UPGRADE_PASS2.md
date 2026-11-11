# GreenHaven 0.224.0 — Massive Upgrade Pass 2
Date: 2026-10-31

## Discovery & Search 2.0

This pass closes a major gap between GreenHaven's durable social search API and the global search UI.

- Durable server results now remain authoritative even when a category returns zero rows; the client no longer silently substitutes session candidates after a valid empty server result.
- Durable post search is now actually rendered instead of being fetched and discarded.
- Durable creator search is surfaced as a first-class search category.
- Durable video search is surfaced as a first-class search category.
- Existing People, Public IDs, Posts, Communities, Events, Activities and Services remain available in one global search surface.
- Search retains privacy/block/mute gates, query debouncing, request cancellation, recent searches and post mutation reconciliation.
- Discovery remains a secondary experience and does not occupy the canonical five-item bottom navigation.

## Product direction

Search is becoming the connective tissue between identity, creators, content, communities, events, activities, marketplace services and opportunities. Server-authoritative sources are preferred wherever they exist; session/local seams remain explicit instead of being disguised as durable data.
