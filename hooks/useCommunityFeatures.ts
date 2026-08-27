import { useCallback, useState } from "react"
import {
  Announcement,
  Poll,
  ScheduledEvent,
  PinnedResource,
  WelcomeMessage,
  CommunityGuidelines,
  GroupRecommendation,
  ModerationAction,
  CommunityStats,
  addVoteToPoll,
  rsvpEvent,
  closeEvent,
} from "@/lib/community-features"

interface CommunityFeaturesState {
  announcements: Record<string, Announcement[]>
  polls: Record<string, Poll[]>
  events: Record<string, ScheduledEvent[]>
  pinnedResources: Record<string, PinnedResource[]>
  welcomeMessages: Record<string, WelcomeMessage>
  guidelines: Record<string, CommunityGuidelines>
  recommendations: Record<string, GroupRecommendation[]>
  moderationActions: Record<string, ModerationAction[]>
  stats: Record<string, CommunityStats>
  acknowledgedGuidelines: Set<string>
}

/**
 * Hook for managing community features within groups
 * All operations are namespaced by groupId to support multiple groups
 * Features are optional and don't affect core chat functionality
 */
export function useCommunityFeatures() {
  const [state, setState] = useState<CommunityFeaturesState>({
    announcements: {},
    polls: {},
    events: {},
    pinnedResources: {},
    welcomeMessages: {},
    guidelines: {},
    recommendations: {},
    moderationActions: {},
    stats: {},
    acknowledgedGuidelines: new Set(),
  })

  // Announcements
  const getAnnouncements = useCallback(
    (groupId: string) => state.announcements[groupId] || [],
    [state.announcements]
  )

  const addAnnouncement = useCallback(
    (groupId: string, announcement: Announcement) => {
      setState(prev => ({
        ...prev,
        announcements: {
          ...prev.announcements,
          [groupId]: [...(prev.announcements[groupId] || []), announcement],
        },
      }))
    },
    []
  )

  const pinAnnouncement = useCallback((groupId: string, announcementId: string) => {
    setState(prev => ({
      ...prev,
      announcements: {
        ...prev.announcements,
        [groupId]: (prev.announcements[groupId] || []).map(a =>
          a.id === announcementId ? { ...a, isPinned: true } : { ...a, isPinned: false }
        ),
      },
    }))
  }, [])

  const removeAnnouncement = useCallback((groupId: string, announcementId: string) => {
    setState(prev => ({
      ...prev,
      announcements: {
        ...prev.announcements,
        [groupId]: (prev.announcements[groupId] || []).filter(a => a.id !== announcementId),
      },
    }))
  }, [])

  // Polls
  const getPolls = useCallback(
    (groupId: string) => state.polls[groupId] || [],
    [state.polls]
  )

  const createPoll = useCallback(
    (groupId: string, poll: Poll) => {
      setState(prev => ({
        ...prev,
        polls: {
          ...prev.polls,
          [groupId]: [...(prev.polls[groupId] || []), poll],
        },
      }))
    },
    []
  )

  const votePoll = useCallback((groupId: string, pollId: string, optionId: string, userId: string) => {
    setState(prev => ({
      ...prev,
      polls: {
        ...prev.polls,
        [groupId]: (prev.polls[groupId] || []).map(poll =>
          poll.id === pollId ? addVoteToPoll(poll, optionId, userId) : poll
        ),
      },
    }))
  }, [])

  const closePoll = useCallback((groupId: string, pollId: string) => {
    setState(prev => ({
      ...prev,
      polls: {
        ...prev.polls,
        [groupId]: (prev.polls[groupId] || []).map(poll =>
          poll.id === pollId ? { ...poll, status: "closed" as const } : poll
        ),
      },
    }))
  }, [])

  // Events
  const getEvents = useCallback(
    (groupId: string) => state.events[groupId] || [],
    [state.events]
  )

  const createEvent = useCallback(
    (groupId: string, event: ScheduledEvent) => {
      setState(prev => ({
        ...prev,
        events: {
          ...prev.events,
          [groupId]: [...(prev.events[groupId] || []), event],
        },
      }))
    },
    []
  )

  const rsvpToEvent = useCallback(
    (groupId: string, eventId: string, userId: string, status: "yes" | "maybe" | "no") => {
      setState(prev => ({
        ...prev,
        events: {
          ...prev.events,
          [groupId]: (prev.events[groupId] || []).map(event =>
            event.id === eventId ? rsvpEvent(event, userId, status) : event
          ),
        },
      }))
    },
    []
  )

  const completeEvent = useCallback((groupId: string, eventId: string) => {
    setState(prev => ({
      ...prev,
      events: {
        ...prev.events,
        [groupId]: (prev.events[groupId] || []).map(event =>
          event.id === eventId ? closeEvent(event) : event
        ),
      },
    }))
  }, [])

  // Pinned Resources
  const getPinnedResources = useCallback(
    (groupId: string) => state.pinnedResources[groupId] || [],
    [state.pinnedResources]
  )

  const addPinnedResource = useCallback(
    (groupId: string, resource: PinnedResource) => {
      setState(prev => ({
        ...prev,
        pinnedResources: {
          ...prev.pinnedResources,
          [groupId]: [...(prev.pinnedResources[groupId] || []), resource].sort((a, b) => a.order - b.order),
        },
      }))
    },
    []
  )

  const removePinnedResource = useCallback((groupId: string, resourceId: string) => {
    setState(prev => ({
      ...prev,
      pinnedResources: {
        ...prev.pinnedResources,
        [groupId]: (prev.pinnedResources[groupId] || []).filter(r => r.id !== resourceId),
      },
    }))
  }, [])

  // Welcome Message
  const getWelcomeMessage = useCallback(
    (groupId: string) => state.welcomeMessages[groupId] || null,
    [state.welcomeMessages]
  )

  const setWelcomeMessage = useCallback((groupId: string, message: WelcomeMessage) => {
    setState(prev => ({
      ...prev,
      welcomeMessages: {
        ...prev.welcomeMessages,
        [groupId]: message,
      },
    }))
  }, [])

  // Guidelines
  const getGuidelines = useCallback(
    (groupId: string) => state.guidelines[groupId] || null,
    [state.guidelines]
  )

  const setGuidelines = useCallback((groupId: string, guidelines: CommunityGuidelines) => {
    setState(prev => ({
      ...prev,
      guidelines: {
        ...prev.guidelines,
        [groupId]: guidelines,
      },
    }))
  }, [])

  const acknowledgeGuidelines = useCallback((guidelineId: string) => {
    setState(prev => ({
      ...prev,
      acknowledgedGuidelines: new Set([...prev.acknowledgedGuidelines, guidelineId]),
    }))
  }, [])

  // Recommendations
  const getRecommendations = useCallback(
    (groupId: string) => state.recommendations[groupId] || [],
    [state.recommendations]
  )

  const setRecommendations = useCallback((groupId: string, recommendations: GroupRecommendation[]) => {
    setState(prev => ({
      ...prev,
      recommendations: {
        ...prev.recommendations,
        [groupId]: recommendations,
      },
    }))
  }, [])

  // Moderation
  const getModerationActions = useCallback(
    (groupId: string) => state.moderationActions[groupId] || [],
    [state.moderationActions]
  )

  const addModerationAction = useCallback((groupId: string, action: ModerationAction) => {
    setState(prev => ({
      ...prev,
      moderationActions: {
        ...prev.moderationActions,
        [groupId]: [...(prev.moderationActions[groupId] || []), action],
      },
    }))
  }, [])

  // Stats
  const getStats = useCallback(
    (groupId: string) => state.stats[groupId] || null,
    [state.stats]
  )

  const updateStats = useCallback((groupId: string, stats: CommunityStats) => {
    setState(prev => ({
      ...prev,
      stats: {
        ...prev.stats,
        [groupId]: stats,
      },
    }))
  }, [])

  return {
    // Announcements
    getAnnouncements,
    addAnnouncement,
    pinAnnouncement,
    removeAnnouncement,
    // Polls
    getPolls,
    createPoll,
    votePoll,
    closePoll,
    // Events
    getEvents,
    createEvent,
    rsvpToEvent,
    completeEvent,
    // Pinned Resources
    getPinnedResources,
    addPinnedResource,
    removePinnedResource,
    // Welcome Message
    getWelcomeMessage,
    setWelcomeMessage,
    // Guidelines
    getGuidelines,
    setGuidelines,
    acknowledgeGuidelines,
    hasAcknowledgedGuidelines: (guidelineId: string) => state.acknowledgedGuidelines.has(guidelineId),
    // Recommendations
    getRecommendations,
    setRecommendations,
    // Moderation
    getModerationActions,
    addModerationAction,
    // Stats
    getStats,
    updateStats,
  }
}
