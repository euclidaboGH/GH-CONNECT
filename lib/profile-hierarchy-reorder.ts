/**
 * Profile Section Hierarchy Reordering
 * Reorders MyProfile sections for optimal UX hierarchy while preserving all components
 * 
 * Hierarchy Order:
 * 1. Sticky header + Cover + Avatar/ring + Name/Age/Location  
 * 2. Mode buttons + Edit Profile + Preview Public Profile
 * 3. Complete your profile card (only if needed)
 * 4. Interests
 * 5. Achievements
 * 6. My Posts
 * 7. Recent Activity
 * 8. Social Links
 * 9. Share via QR Code
 * 10. Privacy Controls
 * 11. Profile Analytics + Follower Insights + Skills
 */

export const PROFILE_SECTIONS_HIERARCHY = [
  // Section 1: Sticky header + Cover + Avatar + Name/Age/Location
  {
    id: "header-visual",
    order: 1,
    components: [
      "sticky-header",
      "cover-photo",
      "profile-completion-ring",
      "name-age-location",
      "expandable-bio",
      "profile-stats-row"
    ],
    stickyTop: true,
    className: "pb-4"
  },
  
  // Section 2: Mode buttons + Edit + Preview
  {
    id: "profile-actions",
    order: 2,
    components: ["mode-buttons", "edit-profile-button", "preview-public-toggle"],
    className: "px-4 py-4 space-y-3"
  },

  // Section 3: Complete profile card (conditional)
  {
    id: "completion-card",
    order: 3,
    components: ["profile-completion-banner"],
    className: "px-4 py-4 border-t border-gray-200",
    condition: "profile.completion < 100"
  },

  // Section 4: Interests
  {
    id: "interests",
    order: 4,
    components: ["interests-pills"],
    className: "px-4 py-4 border-t border-gray-200",
    header: "Interests"
  },

  // Section 5: Achievements
  {
    id: "achievements",
    order: 5,
    components: ["achievements-section"],
    className: "px-4 py-4 border-t border-gray-200",
    header: "Achievements"
  },

  // Section 6: My Posts
  {
    id: "my-posts",
    order: 6,
    components: ["own-posts-list"],
    className: "px-4 py-4 border-t border-gray-200 space-y-3",
    header: "My Posts",
    condition: "myPosts.length > 0"
  },

  // Section 7: Recent Activity
  {
    id: "recent-activity",
    order: 7,
    components: ["activity-history-section"],
    className: "px-4 py-4 border-t border-gray-200",
    header: "Recent Activity",
    expandable: true
  },

  // Section 8: Social Links
  {
    id: "social-links",
    order: 8,
    components: ["social-links-section"],
    className: "px-4 py-4 border-t border-gray-200",
    header: "Social Links",
    expandable: true
  },

  // Section 9: Share via QR Code
  {
    id: "qr-share",
    order: 9,
    components: ["enhanced-qr-profile-share"],
    className: "px-4 py-4 border-t border-gray-200",
    header: "Share Profile",
    expandable: true
  },

  // Section 10: Privacy Controls
  {
    id: "privacy-controls",
    order: 10,
    components: ["privacy-controls-section"],
    className: "px-4 py-4 border-t border-gray-200",
    header: "Privacy & Safety",
    expandable: true
  },

  // Section 11: Profile Analytics + Follower Insights + Skills
  {
    id: "profile-analytics",
    order: 11,
    components: [
      "profile-analytics-card",
      "follower-insights-card",
      "skills-section"
    ],
    className: "px-4 py-4 border-t border-gray-200 space-y-4",
    header: "Profile Analytics",
    expandable: true
  }
]

/**
 * Render profile sections in hierarchy order
 */
export function getProfileSectionsInOrder(profile: any, state: any, handlers: any) {
  return PROFILE_SECTIONS_HIERARCHY
    .filter(section => {
      if (!section.condition) return true
      // Evaluate condition
      const conditionMap: Record<string, boolean> = {
        "profile.completion < 100": profile.completionPercentage < 100,
        "myPosts.length > 0": (state.myPosts?.length || 0) > 0
      }
      return conditionMap[section.condition] ?? true
    })
    .sort((a, b) => a.order - b.order)
}

/**
 * Type-safe section configuration
 */
export type ProfileSection = typeof PROFILE_SECTIONS_HIERARCHY[0]
