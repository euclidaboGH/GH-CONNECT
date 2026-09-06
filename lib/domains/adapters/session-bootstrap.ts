/**
 * Session bootstrap (Step 4).
 * Production: explicit empty collections — never imply seed content.
 * Studio/demo: may return seed helpers (which themselves gate on isDemoDataAllowed).
 */

import { isDemoDataAllowed } from "@/lib/demo-data-policy"
import {
  seedCandidates,
  seedPosts,
  seedStories,
  seedReciprocalInterests,
} from "@/lib/ghc-data"
import type { Candidate, Post, StoryItem, Like } from "@/lib/ghc-types"

/** Prefer this over calling seed* directly from context load paths */
export function bootstrapPosts(): Post[] {
  if (!isDemoDataAllowed()) return []
  return seedPosts()
}

export function bootstrapStories(): StoryItem[] {
  if (!isDemoDataAllowed()) return []
  return seedStories()
}

export function bootstrapCandidates(): Candidate[] {
  if (!isDemoDataAllowed()) return []
  return seedCandidates()
}

export function bootstrapLikes(candidates: Candidate[]): Like[] {
  if (!isDemoDataAllowed()) return []
  return seedReciprocalInterests(candidates)
}

export function emptyPosts(): Post[] {
  return []
}

export function emptyStories(): StoryItem[] {
  return []
}

export function emptyCandidates(): Candidate[] {
  return []
}
