# CURRENT BUILD CONTEXT — GREENHAVEN / GH CONNECT

**Canonical implementation context. Read this before every new build prompt or engineering task.**

## CURRENT BUILD CONTEXT

- Current source release: **0.313.1**.
- Current baseline: the complete repository root in this release, not an earlier Pi App Studio prompt, ZIP, worklog, mock-up, or copied third-party wallet screen.
- Product: GreenHaven ecosystem and GH Connect social platform. Keep the existing product identity, routes, data contracts and security boundaries unless a reviewed implementation explicitly changes them.
- Visual direction: premium, modern, calm and accessible; deep emerald / teal / navy with restrained gold accents; light-mode-first. Screenshots are design references, not sources of banking features, balances, licenses, logos or provider capabilities.
- Wallet: GHC and Pi are separate assets and separate ledgers. Never add them together, convert one into the other for display, fabricate balances, or treat local cache as financial authority. Server-confirmed balances must be clearly distinguished from stale, pending, locked and unavailable data.
- Financial authority: server-side APIs, database RPCs and existing ledger/settlement authorities. Never add client-side minting, transfers, payout execution, refunds, escrow release, treasury movement or payment completion.
- Security: preserve session identity, ownership, step-up, idempotency, rate limits, RLS, service-role boundaries and fail-closed behavior.
- Database: do not apply migrations from source review alone. Reconcile target history, classify, inspect dependencies and obtain approval before applying held migrations.

## DOCUMENT PRECEDENCE

1. Current executable source and current database migration files.
2. `package.json`, `package-lock.json`, `.nvmrc` and deployment configuration.
3. `docs/CURRENT_BUILD_CONTEXT.md` for current product and engineering constraints.
4. `docs/PROJECT_TRUTH.md` and `docs/SOURCE_OF_TRUTH.md` for release facts and verification boundaries.
5. The current release worklog and the feature-specific current audit.
6. All older versioned worklogs, old prompt notes, archived docs, screenshots and videos are **historical context only**. They do not authorize restoring old behavior or supersede current source.

## BUILD RULES

- Start from the latest complete repository ZIP/source tree only.
- Inspect actual implementation before proposing or editing; avoid duplicate components, routes, RPCs, tables, migrations and settlement authorities.
- Prefer extending existing domain boundaries over creating parallel systems.
- Preserve existing design language while making purposeful product-level improvements.
- Do not delete migrations, audit evidence, legal/compliance records or historical release fixtures to make the repository look newer. Archive genuinely obsolete operator material only after checking references and regression gates.
- Every change needs a targeted regression check and must be registered in `prebuild` and `verify:static` where appropriate.
- Report exactly what was changed, what passed, what did not run, and what still requires live infrastructure. Never call source checks production acceptance.

## CURRENT WALLET CHANGE (0.313.1)

The wallet now has bounded server-summary and Pi earnings reads, latest-request-wins cancellation, timeout cleanup and explicit unavailable feedback. The premium wallet hero displays one selected asset rail at a time and only calls GHC balance server-confirmed when the validated snapshot is server-sourced. No financial mutation path or SQL migration is added in this phase.


## PI PAYOUT AUTHORIZATION CHANGE (0.313.1)

- Explicit user consent is required before a Pi earnings withdrawal request is reserved and is independently rechecked by the A2U execution worker immediately before transfer.
- The wallet UI confirms authorization using a fresh server read and requires the active authorization to match the linked Pi app UID.
- Authorization failures expose safe HTTP/error codes; server diagnostics never log service-role credentials or raw upstream SQL messages.
- Keep `PI_A2U_ENABLED`, `PI_EARNINGS_PAYOUT_REQUESTS_ENABLED`, and `PI_EARNINGS_PAYOUT_EXECUTION_ENABLED` operator-controlled. Mainnet remains disabled. No migration is applied by source review.

## CURRENT EXPERIENCE CHANGE (0.313.1)
- Bottom navigation collapses completely during upward feed scrolling and reappears when the user scrolls downward; the scroll owner is resolved from nested scroll surfaces.
- Curation analytics are opened as an accessible modal sheet and fetched on demand with timeout, cancellation and stale-response protection.
- Do not restore the old inline accordion or fetch analytics on every post card mount.
