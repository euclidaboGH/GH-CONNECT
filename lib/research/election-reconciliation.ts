export type ElectionTallyInput = {
  id: string
  geo_unit_id: string
  polling_unit_code: string
  agent_user_id: string
  registered_voters: number | null
  accredited_voters: number | null
  total_ballots: number | null
  valid_votes: number
  rejected_ballots: number
  submitted_at: string
}

export type ElectionCandidateVoteInput = { tally_id: string; candidate_id: string; votes: number }
export type ElectionReconciliationStatus = "awaiting_second_agent" | "consistent" | "discrepancy"

export type ElectionReconciliationGroup = {
  geoUnitId: string
  pollingUnitCode: string
  status: ElectionReconciliationStatus
  independentAgentCount: number
  submissionCount: number
  agents: Array<{ label: string; submittedAt: string; candidateVotes: Array<{ candidateId: string; votes: number }> }>
  discrepancyCodes: string[]
  certified: false
}

const safeCount = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0

export function reconcileElectionTallies(
  tallies: ElectionTallyInput[],
  candidateVotes: ElectionCandidateVoteInput[],
): ElectionReconciliationGroup[] {
  const votesByTally = new Map<string, Map<string, number>>()
  for (const vote of candidateVotes) {
    if (!vote || typeof vote.tally_id !== "string" || typeof vote.candidate_id !== "string" || !safeCount(vote.votes)) continue
    const map = votesByTally.get(vote.tally_id) || new Map<string, number>()
    map.set(vote.candidate_id, vote.votes)
    votesByTally.set(vote.tally_id, map)
  }

  const grouped = new Map<string, ElectionTallyInput[]>()
  for (const tally of tallies) {
    if (!tally || typeof tally.id !== "string" || typeof tally.geo_unit_id !== "string" || typeof tally.polling_unit_code !== "string" || typeof tally.agent_user_id !== "string") continue
    const key = `${tally.geo_unit_id}:${tally.polling_unit_code}`
    const rows = grouped.get(key) || []
    rows.push(tally)
    grouped.set(key, rows)
  }

  return [...grouped.values()].map((rows) => {
    const agentIds = [...new Set(rows.map((row) => row.agent_user_id))]
    const first = rows[0]
    const normalized = rows.map((row) => {
      const candidateMap = votesByTally.get(row.id) || new Map<string, number>()
      const entries = [...candidateMap.entries()].sort(([a], [b]) => a.localeCompare(b))
      const candidateTotal = entries.reduce((sum, [, count]) => sum + count, 0)
      const valid = safeCount(row.valid_votes) && safeCount(row.rejected_ballots) &&
        (row.registered_voters === null || safeCount(row.registered_voters)) &&
        (row.accredited_voters === null || safeCount(row.accredited_voters)) &&
        (row.total_ballots === null || safeCount(row.total_ballots)) &&
        (row.registered_voters === null || row.accredited_voters === null || row.accredited_voters <= row.registered_voters) &&
        (row.total_ballots === null || row.valid_votes + row.rejected_ballots === row.total_ballots) &&
        (row.total_ballots === null || row.accredited_voters === null || row.total_ballots <= row.accredited_voters) &&
        entries.length > 0 && candidateTotal === row.valid_votes
      const signature = JSON.stringify({
        registered: row.registered_voters,
        accredited: row.accredited_voters,
        total: row.total_ballots,
        valid: row.valid_votes,
        rejected: row.rejected_ballots,
        candidates: entries,
      })
      return { row, entries, valid, signature }
    })
    const signatures = new Set(normalized.map((item) => item.signature))
    const discrepancyCodes: string[] = []
    if (normalized.some((item) => !item.valid)) discrepancyCodes.push("INVALID_OR_INCOMPLETE_TALLY")
    if (signatures.size > 1) discrepancyCodes.push("AGENT_TALLY_MISMATCH")
    const status: ElectionReconciliationStatus = agentIds.length < 2
      ? "awaiting_second_agent"
      : discrepancyCodes.length === 0 ? "consistent" : "discrepancy"
    return {
      geoUnitId: first.geo_unit_id,
      pollingUnitCode: first.polling_unit_code,
      status,
      independentAgentCount: agentIds.length,
      submissionCount: rows.length,
      agents: normalized.map((item, index) => ({
        label: `Agent ${index + 1}`,
        submittedAt: item.row.submitted_at,
        candidateVotes: item.entries.map(([candidateId, votes]) => ({ candidateId, votes })),
      })),
      discrepancyCodes,
      certified: false as const,
    }
  }).sort((a, b) => a.pollingUnitCode.localeCompare(b.pollingUnitCode))
}
