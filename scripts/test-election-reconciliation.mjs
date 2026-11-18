#!/usr/bin/env node
import assert from 'node:assert/strict'
import { reconcileElectionTallies } from '../lib/research/election-reconciliation.ts'

const base = {
  geo_unit_id: 'geo-1', polling_unit_code: 'PU-001', registered_voters: 100,
  accredited_voters: 80, total_ballots: 75, valid_votes: 70, rejected_ballots: 5,
}
const tallies = [
  { ...base, id: 't1', agent_user_id: 'agent-a', submitted_at: '2026-11-18T03:00:00.000Z' },
  { ...base, id: 't2', agent_user_id: 'agent-b', submitted_at: '2026-11-18T03:05:00.000Z' },
]
const votes = [
  { tally_id: 't1', candidate_id: 'candidate-a', votes: 40 },
  { tally_id: 't1', candidate_id: 'candidate-b', votes: 30 },
  { tally_id: 't2', candidate_id: 'candidate-a', votes: 40 },
  { tally_id: 't2', candidate_id: 'candidate-b', votes: 30 },
]

const consistent = reconcileElectionTallies(tallies, votes)
assert.equal(consistent.length, 1)
assert.equal(consistent[0].status, 'consistent')
assert.equal(consistent[0].independentAgentCount, 2)
assert.equal(consistent[0].certified, false)
console.log('PASS two distinct agents with identical complete counts are marked consistent, not certified')

const mismatch = reconcileElectionTallies(tallies, [...votes.slice(0, 2), { ...votes[2], votes: 39 }, { ...votes[3], votes: 31 }])
assert.equal(mismatch[0].status, 'discrepancy')
assert.ok(mismatch[0].discrepancyCodes.includes('AGENT_TALLY_MISMATCH'))
console.log('PASS different candidate vote distributions are flagged for review')

const single = reconcileElectionTallies(tallies.slice(0, 1), votes.slice(0, 2))
assert.equal(single[0].status, 'awaiting_second_agent')
console.log('PASS one submission cannot satisfy independent reconciliation')

const duplicateAgent = reconcileElectionTallies([tallies[0], { ...tallies[1], agent_user_id: 'agent-a' }], votes)
assert.equal(duplicateAgent[0].independentAgentCount, 1)
assert.equal(duplicateAgent[0].status, 'awaiting_second_agent')
console.log('PASS repeated records from one agent do not count as independent')

const invalid = reconcileElectionTallies(tallies, [...votes.slice(0, 2), { ...votes[2], votes: 69 }, votes[3]])
assert.equal(invalid[0].status, 'discrepancy')
assert.ok(invalid[0].discrepancyCodes.includes('INVALID_OR_INCOMPLETE_TALLY'))
console.log('PASS candidate totals that do not equal valid votes are flagged')

const otherUnit = reconcileElectionTallies([...tallies, { ...tallies[1], id: 't3', geo_unit_id: 'geo-2', polling_unit_code: 'PU-002', agent_user_id: 'agent-c' }], [...votes, { tally_id: 't3', candidate_id: 'candidate-a', votes: 70 }, { tally_id: 't3', candidate_id: 'candidate-b', votes: 0 }])
assert.equal(otherUnit.length, 2)
console.log('PASS tallies from different polling units are never compared together')

console.log('\\nElection reconciliation: 6/6 passed')
