/**
 * Home activation checklist — derived from real session/server-backed data only.
 * Never fabricates completion. Authoritative signals:
 * - profile fields from hydrated profile (server-backed when available)
 * - community membership from real conversation/membership lists
 * - first post from real feed posts authored by the viewer
 */

export type ActivationItemId =
  | "photo"
  | "bio"
  | "interests"
  | "community"
  | "first_post"

export type ActivationItem = {
  id: ActivationItemId
  label: string
  done: boolean
  /** Navigation target when incomplete */
  target: "profile" | "communities" | "compose" | "home"
}

export type ActivationChecklistInput = {
  hasPhoto: boolean
  hasBio: boolean
  interestsCount: number
  myCommunitiesCount: number
  /** True only when viewer has at least one post known from real feed data */
  hasOwnPost: boolean
}

export type ActivationChecklistResult = {
  items: ActivationItem[]
  doneCount: number
  total: number
  /** All items done — UI should hide the checklist */
  complete: boolean
  percent: number
}

const INTEREST_MIN = 2

export function buildHomeActivationChecklist(
  input: ActivationChecklistInput
): ActivationChecklistResult {
  const items: ActivationItem[] = [
    {
      id: "photo",
      label: "Profile photo",
      done: input.hasPhoto === true,
      target: "profile",
    },
    {
      id: "bio",
      label: "Bio",
      done: input.hasBio === true,
      target: "profile",
    },
    {
      id: "interests",
      label: "Interests",
      done: input.interestsCount >= INTEREST_MIN,
      target: "profile",
    },
    {
      id: "community",
      label: "Join a community",
      done: input.myCommunitiesCount > 0,
      target: "communities",
    },
    {
      id: "first_post",
      label: "First post",
      done: input.hasOwnPost === true,
      target: "compose",
    },
  ]

  const doneCount = items.filter((i) => i.done).length
  const total = items.length
  const complete = doneCount === total
  const percent = total === 0 ? 100 : Math.round((doneCount / total) * 100)

  return { items, doneCount, total, complete, percent }
}
