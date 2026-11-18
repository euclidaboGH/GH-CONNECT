# GreenHaven upgrade worklog — 0.287.0

Date: 2026-11-03

## Scope
Notifications focus segment + category unread counts, feed pill filters, project-truth / VERIFIED_MANIFEST sync (`project_version=0.287.0`), Pass 20 membership path honesty copy.

## Verification
All gates in this release are **source-level** / **source-only** contracts and isolated helper tests. They do not prove applied database state, live Pi A2U funding, or production runtime on Vercel beyond static prebuild.

Runtime requirement remains **Node.js 24.15.0** (see `.nvmrc` and `package.json` engines).

## Financial authority
No client-side balance invention. Membership remains a separate benefit path (Free, VIP and VVIP benefits open on Membership — not from Wallet balance cards).

## Operator
Production remains NOT APPROVED until Testnet evidence, migration apply, and funded A2U verification.
