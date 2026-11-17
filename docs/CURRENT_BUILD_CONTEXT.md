# CURRENT BUILD CONTEXT — 0.338.92 (2026-11-17)

- **Current source:** `GREENHAVEN-0.338.92-SCOPED-EVIDENCE-2026-11-17.zip`.
- **Package:** `gh-connect@0.338.92`; package, lockfile and in-app release identity synchronized.
- **Baseline:** supplied GreenHaven 0.338.90 Media Evidence Engine archive.
- **Latest work:** public respondent and direct field-agent scoped uploads, SHA-256 streaming, magic-byte validation, quarantine-first evidence records, central evidence review workspace, scanner queue/HMAC result callback contract, geographic-unit validation and append-only evidence hash chain.
- **Scanner limitation:** no trusted AV worker/provider or scanner secret has been configured. All newly uploaded evidence remains quarantined and content routes deny access until a scanner callback reports clean for the exact stored SHA-256.
- **Geography limitation:** active `gh_research_geo_units` references are validated; no national Nigeria hierarchy dataset or GPS/EXIF provenance is included.
- **Migrations:** foundation `20261116182000`, media integration `20261116190000`, scoped upload/chain `20261117010001` are REVIEW_REQUIRED and unapplied. Existing Field Reports `20261116170409` and Research Studio `20261116171144` remain applied to Testnet.
- **Runtime:** Node 22.16.0 available; project requires Node 24.15.0. Dependencies absent. Full typecheck/lint/build and browser acceptance not completed.
- **Deployment:** no GitHub push, Vercel deployment or Mainnet changes. Production NOT APPROVED.
