import assert from 'node:assert/strict'
import { validateResearchLogic, isResearchQuestionVisible, reconcileElectionTally } from '../lib/research/logic.ts'
const base = [
  { id: 'q1', type: 'single_choice', label: 'Continue?', options: ['Yes', 'No'] },
  { id: 'q2', type: 'short_text', label: 'Explain', showWhen: { questionId: 'q1', operator: 'equals', value: 'Yes' } },
]
assert.deepEqual(validateResearchLogic(base), { ok: true })
assert.equal(isResearchQuestionVisible(base[1].showWhen, { q1: 'Yes' }), true)
assert.equal(isResearchQuestionVisible(base[1].showWhen, { q1: 'No' }), false)
assert.equal(isResearchQuestionVisible({ questionId: 'q1', operator: 'answered' }, { q1: 'Yes' }), true)
assert.equal(isResearchQuestionVisible({ questionId: 'q1', operator: 'not_answered' }, {}), true)
assert.equal(validateResearchLogic([{ ...base[1], showWhen: { questionId: 'later', operator: 'equals', value: 'x' } }]).ok, false)
assert.equal(validateResearchLogic([{ id: 'a', type: 'text', label: 'A' }, { id: 'b', type: 'text', label: 'B', showWhen: { questionId: 'a', operator: 'unsupported', value: 'x' } }]).ok, false)
const clean = reconcileElectionTally({ candidateVotes: [120, 80], validVotes: 200, rejectedBallots: 10, totalBallots: 210, accreditedVoters: 220, registeredVoters: 300 })
assert.equal(clean.reconciled, true)
const mismatch = reconcileElectionTally({ candidateVotes: [120, 70], validVotes: 200, rejectedBallots: 10, totalBallots: 205, accreditedVoters: 190, registeredVoters: 180 })
assert.deepEqual(mismatch.discrepancies, ['CANDIDATE_TOTAL_MISMATCH', 'BALLOT_TOTAL_MISMATCH', 'BALLOTS_EXCEED_ACCREDITED', 'ACCREDITED_EXCEED_REGISTERED'])
console.log('Research intelligence logic: 8/8 PASS')
