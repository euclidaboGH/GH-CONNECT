# Upgrade worklog — 0.271.2

## Migration documents synchronized

- Regenerated inventory via `scripts/generate-migration-inventory.mjs` (**172** SQL files).
- Checklist notes for `20261029010005` (hasMapping expression) and `20261101090001` (idempotent get fix).
- `docs/SOURCE_OF_TRUTH.md` canonical migration count → **172**.
- VERIFIED_MANIFEST + MIGRATION-SOURCE-MANIFEST.csv byte sizes and class totals aligned (REQUIRED 112).

Source-level / source-only verification only; inventory is not applied-state evidence.

Supported runtime: Node.js 24.15.0.
