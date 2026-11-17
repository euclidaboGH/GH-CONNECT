# GreenHaven — Residual Technical Debt Hardening
## 2026-10-31

### Scope
This pass addresses the residual items identified in the two-hour consolidation audit:
- unbounded `request.json()` route parsing;
- native browser `window.confirm()` / `window.prompt()` UX;
- UI polling that duplicated the realtime/event architecture.

### API request-body hardening
All application API routes that previously used raw `request.json()` now use the shared streaming `readBoundedJson()` parser with route-appropriate limits. Oversized bodies return 413 and malformed/invalid bodies return an explicit 400-class response where the route requires a body.

This includes payment/A2U, operator, payout, economy, identity, social, reputation, notification, announcement, WebAuthn, marketplace, community and messaging-adjacent routes that remained in the residual inventory.

### Modern interaction dialogs
Native browser confirmation/prompt dialogs were removed from GreenHaven UI components. A single app-level interaction dialog now provides:
- consistent GreenHaven styling;
- accessible modal semantics;
- keyboard Escape/Enter behavior;
- danger/destructive styling;
- password/text input support;
- bounded prompt input;
- consistent Cancel/Confirm actions.

The dialog is used for post deletion, comment deletion, blocking, passkey revocation/labeling, session revocation, Community moderation actions, draft discard and device-PIN setup.

### Polling cleanup
Removed redundant UI polling from:
- open comment sheets;
- open message threads for message refresh;
- connection-inbox badge refresh;
- offline pending-action badge.

These now use domain events / section refresh coordination. Offline queue mutations emit `ghc:offline-queue-changed` so the pending badge updates immediately.

Retained timers are intentionally classified as legitimate protocol/recovery behavior, including:
- Pi payment SDK readiness checks;
- presence heartbeats/leases;
- content countdown/time-relative labels;
- server-side execution heartbeats;
- analytics batching;
- realtime transport retry;
- low-frequency recovery polling where push delivery can legitimately be missed;
- wallet/notification/feed recovery reconciliation.

### Verification
- Full static verification: **57/57 PASS**
- Bounded JSON import contract: **99 routes checked**
- Section refresh: **12/12 PASS**
- Community global standard: **11/11 PASS**
- Shell/realtime/scroll: **8/8 PASS**
- Post/curation production: **12/12 PASS**
- Residual debt hardening: **PASS**

### Build note
A full Node 24 dependency-backed production build was not executed in this extracted workspace because `node_modules` is absent and the available local runtime is Node 22.16.0 while the project requires Node 24.15.0+. Vercel/CI Node 24 remains the authoritative compiler/runtime gate.
