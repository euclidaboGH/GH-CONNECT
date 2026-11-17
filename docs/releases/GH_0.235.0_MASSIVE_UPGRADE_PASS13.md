> **LEGACY VERIFICATION FIXTURE — HISTORICAL RELEASE RECORD, NOT CURRENT PRODUCT AUTHORITY.**
> Consult `docs/SOURCE_OF_TRUTH.md` and `docs/PROJECT_TRUTH.md` for current authority. Preserve this file for historical traceability only.

# GreenHaven 0.235.0 — Massive Upgrade Pass 13

## Resilience, Performance & Mobile Recovery

This release strengthens the everyday experience under the network conditions that matter most on mobile devices: temporary loss of connectivity, constrained data connections, and transient upstream failures. The work is intentionally non-invasive to the economy, payments, identity, marketplace, and database model. It improves how the client communicates degraded conditions and how safe read requests recover from temporary transport failures.

### Delivered

- Replaced overlapping offline indicators with one unified `NetworkResilience` surface.
- Added explicit offline, restored-connection, and constrained-connection states.
- Avoided claiming that all actions are queued; the UI now accurately communicates that server actions may be unavailable while offline.
- Added connection-aware messaging for Save-Data / 2G / slow-2G conditions.
- Added bounded automatic retry for idempotent GET requests only, limited to transient transport/server statuses.
- Preserved caller-supplied abort signals by leaving explicitly signalled requests at one attempt.
- Preserved all existing server-authoritative writes, payment flows, wallet controls, and navigation.
- No Supabase migrations were changed.

### Verification

The Pass 13 static resilience gate verifies release metadata, the unified network surface, degraded-network messaging, connection-quality awareness, restored-state communication, transient GET retry boundaries, and migration non-touching.

A full Next.js build/typecheck remains environment-dependent on Node 24.15+ and the project's installed dependency tree; this pass does not claim a clean production build from the available Node 22 runtime.
