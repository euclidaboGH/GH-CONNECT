/**
 * Public content reward types — display only.
 * Amounts are never client-authoritative. Vote paths must not mint GHC.
 */

export type ContentRewardStatus =
  | "inactive" // feature / pool not funded
  | "accruing" // window open; server has recorded provisional totals
  | "finalized" // window closed; amounts fixed; not yet paid
  | "distributed" // ledger settlement completed
  | "voided" // rejected / reversed

export interface ContentRewardPublic {
  ok: true
  postId: string
  /** False until platform funds a pool and system writes a row */
  enabled: boolean
  status: ContentRewardStatus
  statusLabel: string
  /** GHC totals — null when inactive or unavailable */
  totalEarned: number | null
  authorReward: number | null
  curationReward: number | null
  upvoteImpact: number | null
  downvoteImpact: number | null
  netImpact: number | null
  currency: "GHC"
  /** Public vote counts (quality signal; not wallet) */
  upvoteCount: number
  downvoteCount: number
  /** Optional public curator contribution previews (server-curated only) */
  topContributors: Array<{
    username: string
    /** Display amount only when status is accruing|finalized|distributed */
    amount: number | null
  }>
  durable: boolean
  /** Human-readable note when rewards are not active */
  note?: string
}

export interface ContentRewardError {
  ok: false
  error: string
}

/** Author/curation split — display defaults; actual split is server-stored per post */
export const CONTENT_REWARD_AUTHOR_SHARE = 0.7
export const CONTENT_REWARD_CURATION_SHARE = 0.3
