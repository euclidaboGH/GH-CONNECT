# Upgrade worklog — 0.270.0

## Feel-better UX wave 4
- Community hub Board/Chat tabs: taller pills, selected depth
- Message status copy shortened (Read / Delivered / Sent)
- Marketplace checkout CTAs + success/error surfaces
- Wallet balance rail control sizing
- Settings rows more touch-comfortable
- Feed post action row spacing; story ring offset where matched

Carries payout auth (0.266.x) and prior feel-better waves.

This package used **source-level** / **source-only** verification (static contracts and isolated helper tests). Runtime limitation: live database application and Pi Testnet settlement were not executed in the packaging environment.

Supported runtime: Node.js **24.15.0**.
