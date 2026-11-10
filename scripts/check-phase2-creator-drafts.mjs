#!/usr/bin/env node
/** Phase II #14 — Creator Studio draft continuity without inventing scheduling. */
import fs from 'node:fs'
import assert from 'node:assert/strict'
const panel = fs.readFileSync(new URL('../components/ghc/creator-studio-panel.tsx', import.meta.url), 'utf8')
const drafts = fs.readFileSync(new URL('../lib/creator/post-drafts.ts', import.meta.url), 'utf8')
const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const checks = [
  ['Creator Studio reads the existing local draft store', panel.includes('listPostDrafts') && panel.includes('setDrafts(listPostDrafts())')],
  ['draft list refreshes when drafts change', panel.includes('ghc:post-drafts-changed')],
  ['drafts are opened through the existing composer draft contract', panel.includes('ghc:open-compose') && panel.includes('draftId: draft.id')],
  ['draft deletion uses the canonical local draft helper', panel.includes('removePostDraft(draft.id)')],
  ['drafts are visibly disclosed as device-local and unpublished', panel.includes('Saved on this device · not published') && panel.includes('not synced across devices')],
  ['scheduled publishing is not misrepresented as implemented', panel.includes('Scheduled publishing is not enabled here')],
  ['no automatic publishing or schedule mutation is introduced', !/schedulePost|publishAt|scheduledFor\s*=/.test(panel)],
  ['draft storage remains bounded', drafts.includes('const MAX = 20') && drafts.includes('.slice(0, MAX)')],
  ['draft storage is account-scoped to prevent shared-device leakage', drafts.includes('ghc.post-drafts.v2:') && drafts.includes('IdentityService.getCurrentUserId()')],
  ['unowned legacy drafts are not imported into an arbitrary account', drafts.includes('Never import it into an arbitrary') && drafts.includes('hasUnscopedLegacyPostDrafts') && panel.includes('have no recorded account owner')],
  ['draft content remains bounded', drafts.includes('.slice(0, 5000)')],
  ['Creator Studio draft contract is registered in prebuild and static verification', ['prebuild:checks', 'verify:static'].every((key) => pkg.scripts[key]?.includes('check-phase2-creator-drafts.mjs'))],
]
let failures = 0
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failures++ }
console.log(`Phase II Creator Studio draft contract: ${checks.length - failures}/${checks.length} passed`)
assert.equal(failures, 0, 'Phase II Creator Studio draft contract failed')
