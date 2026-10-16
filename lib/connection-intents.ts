/**
 * Connection intent system — multi-select preferences for Discover.
 * Broader than single primaryMode; primaryMode remains a soft default.
 */

/**
 * First-class connection intents — multi-select; not forced into a single "friend" model.
 * Existing ids remain stable for backward compatibility.
 */
export const CONNECTION_INTENT_OPTIONS = [
  { id: "friendship", label: "Friendship", desc: "Genuine friends & shared interests" },
  { id: "dating", label: "Dating", desc: "Romance & relationships" },
  { id: "networking", label: "Networking", desc: "Professional connections" },
  { id: "professional", label: "Professional", desc: "Career peers and industry contacts" },
  { id: "business", label: "Business", desc: "Clients, partners, growth" },
  { id: "collaboration", label: "Collaboration", desc: "Projects & building together" },
  { id: "communities", label: "Communities", desc: "Groups & local chapters" },
  { id: "mentorship", label: "Mentorship", desc: "Mentor or be mentored" },
  { id: "learning", label: "Learning", desc: "Skills, courses, and knowledge exchange" },
  { id: "volunteering", label: "Volunteering", desc: "Causes and community service" },
  { id: "events", label: "Events", desc: "Meetups, gatherings, and live activities" },
] as const

export type ConnectionIntentId = (typeof CONNECTION_INTENT_OPTIONS)[number]["id"]

const STORAGE_KEY = "ghc_connection_intents_v1"

export function normalizeIntents(raw: unknown): ConnectionIntentId[] {
  if (!Array.isArray(raw)) return []
  const allowed = new Set(CONNECTION_INTENT_OPTIONS.map((o) => o.id))
  const out: ConnectionIntentId[] = []
  for (const x of raw) {
    const id = String(x).toLowerCase().trim() as ConnectionIntentId
    if (allowed.has(id) && !out.includes(id)) out.push(id)
  }
  return out
}

export function loadConnectionIntents(userId = "current-user"): ConnectionIntentId[] {
  try {
    if (typeof localStorage === "undefined") return []
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}")
    return normalizeIntents(all[userId])
  } catch {
    return []
  }
}

export function saveConnectionIntents(userId: string, intents: ConnectionIntentId[]) {
  try {
    if (typeof localStorage === "undefined") return
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}")
    all[userId] = normalizeIntents(intents)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  } catch {
    /* */
  }
}

/** Map legacy primaryMode into intents when none saved */
export function intentsFromPrimaryMode(mode?: string | null): ConnectionIntentId[] {
  const m = String(mode || "").toLowerCase()
  if (m === "dating") return ["dating"]
  if (m === "networking") return ["networking"]
  if (m === "professional") return ["professional", "networking"]
  if (m === "friendship" || m === "friends") return ["friendship"]
  if (m === "business") return ["business"]
  if (m === "collaboration") return ["collaboration"]
  if (m === "mentorship") return ["mentorship"]
  if (m === "learning") return ["learning"]
  if (m === "volunteering") return ["volunteering"]
  if (m === "events") return ["events"]
  return ["friendship", "networking"]
}

export function resolveUserIntents(
  userId: string,
  profile?: { connectionIntents?: string[]; primaryMode?: string } | null
): ConnectionIntentId[] {
  const fromProfile = normalizeIntents(profile?.connectionIntents)
  if (fromProfile.length) return fromProfile
  const stored = loadConnectionIntents(userId)
  if (stored.length) return stored
  return intentsFromPrimaryMode(profile?.primaryMode)
}

/**
 * Score how well a candidate matches the viewer's connection intents.
 * Higher = better ranking signal for Discover.
 */
export function scoreIntentMatch(
  viewerIntents: ConnectionIntentId[],
  candidate: {
    bio?: string
    interests?: string[]
    profession?: string
    occupation?: string
    relationshipGoals?: string[]
    connectionIntents?: string[]
    primaryMode?: string
  }
): number {
  if (!viewerIntents.length) return 1
  const candIntents = normalizeIntents(candidate.connectionIntents)
  const fallback = intentsFromPrimaryMode(candidate.primaryMode)
  const theirs = candIntents.length ? candIntents : fallback

  let score = 0
  for (const v of viewerIntents) {
    if (theirs.includes(v)) score += 3
  }

  const blob = [
    candidate.bio,
    ...(candidate.interests || []),
    candidate.profession,
    candidate.occupation,
    ...(candidate.relationshipGoals || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()

  const keywords: Record<ConnectionIntentId, RegExp> = {
    friendship: /friend|hobby|sport|music|travel|game|hang/,
    dating: /dating|relationship|single|romance|love/,
    networking: /network|career|professional|linkedin|role/,
    professional: /engineer|designer|developer|manager|industry|career/,
    business: /business|client|brand|entrepreneur|startup|sell/,
    collaboration: /collab|project|partner|co-?found|build|team/,
    communities: /community|group|chapter|local|chapter/,
    mentorship: /mentor|coach|advise|guide|senior|junior/,
    learning: /learn|course|skill|study|tutorial|education/,
    volunteering: /volunteer|charity|cause|nonprofit|give\s?back/,
    events: /event|meetup|conference|gathering|workshop/,
  }

  for (const v of viewerIntents) {
    if (keywords[v]?.test(blob)) score += 1
  }

  return score
}
