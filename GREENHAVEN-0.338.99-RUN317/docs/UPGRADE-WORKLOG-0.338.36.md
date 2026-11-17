# UPGRADE WORKLOG 0.338.36

Cross-domain integrity pack (30 upgrades):

- Curation client guards (self, debounce, humanize)
- A2U withdrawal authorization checklist (session, identity, consent, PIN, balance, no preview reserve)
- Auth session integrity snapshot (max 8, step-up for withdraw)
- Rewards claim → wallet/rewards event bus
- Payments pipeline timeouts/credentials/500bps commission
- Profile public projection strips financial fields
- Post engagement contract event

Reservation policy unchanged: quote/consent do not reserve; accepted payout does.
Production NOT APPROVED.
