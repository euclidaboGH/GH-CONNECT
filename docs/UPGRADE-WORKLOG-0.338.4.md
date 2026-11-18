# UPGRADE WORKLOG 0.338.4

## Gate repair (CI #228 / Vercel prebuild)
- Restored Priority 3 durable mission completion pattern: achievements first, then durableMissionIds Set from achievements.map
- Fixed Phase 1-12 worklog so source-only / source-level / isolated helper test and Node.js 24.15.0 match the gate regex (no markdown bold inside the runtime token)

## Carried from 0.338.3
- Spend RPC TypeScript narrowing wrapper
- Communities directoryOffset dedupe
- Wallet refresh void return
- Profile id-only feed preference owner

## Verification boundary
This release uses source-only verification (source-level static gates and isolated helper tests).
Supported build runtime: Node.js 24.15.0

Production remains NOT APPROVED.
