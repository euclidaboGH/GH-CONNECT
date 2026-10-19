# GreenHaven 0.61.6

- Added an owner-authorized private media content facade with strict signed-origin validation.
- Improved account export completeness using bounded pagination and fail-closed row ceilings.
- Hardened account lifecycle request parsing.
- Added Phase 16 source regression tests.

This is a source-level candidate. Private media sharing across every application surface and actual account deletion remain incomplete; see `PHASE_16_PRIVATE_MEDIA_ACCOUNT_HARDENING_2026-10-19.md`.
