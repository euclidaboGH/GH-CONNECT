# UPGRADE WORKLOG 0.338.5

## TypeScript + Phase 8 history gate
- Restored exact `const achievements = serverAchievements.filter` for Phase 8 history
- `durableMissionIds` remains `new Set(achievements.map((row) => row.id))` for Priority 3 deep gate, typed as Set<string> for MissionCode.has
- spend-rpc-contract: ambient .d.ts for .mjs; removed unused @ts-expect-error

## Verification boundary
This release uses source-only verification (source-level static gates and isolated helper tests).
Supported build runtime: Node.js 24.15.0

Production remains NOT APPROVED.
