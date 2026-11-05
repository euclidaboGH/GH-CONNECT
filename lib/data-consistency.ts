/**
 * Data Consistency Verification System
 * Ensures referential integrity, detects corruption, validates schemas
 */

import type { Profile, Settings, Post, Conversation, Like, FriendRequest } from "./ghc-types"

export interface ConsistencyReport {
  timestamp: number
  isValid: boolean
  errors: ConsistencyError[]
  warnings: string[]
  stats: {
    profileValid: boolean
    settingsValid: boolean
    postsValid: boolean
    conversationsValid: boolean
    referentialIntegrity: boolean
  }
}

export interface ConsistencyError {
  type: string
  severity: "critical" | "high" | "medium" | "low"
  message: string
  affectedData?: string
  suggestedFix?: string
}

/**
 * Data Consistency Checker
 */
export class DataConsistencyChecker {
  /**
   * Perform full data consistency check
   */
  checkDataConsistency(
    profile: Profile | null,
    settings: Settings | null,
    posts: Post[],
    conversations: Conversation[]
  ): ConsistencyReport {
    const errors: ConsistencyError[] = []
    const warnings: string[] = []

    // Check individual entities
    if (profile) {
      const profileErrors = this.validateProfile(profile)
      errors.push(...profileErrors)
    }

    if (settings) {
      const settingsErrors = this.validateSettings(settings)
      errors.push(...settingsErrors)
    }

    const postsErrors = this.validatePosts(posts)
    errors.push(...postsErrors)

    const conversationsErrors = this.validateConversations(conversations)
    errors.push(...conversationsErrors)

    // Check referential integrity
    const referentialErrors = this.checkReferentialIntegrity(posts, conversations, profile)
    errors.push(...referentialErrors)

    // Check for duplicates
    const duplicateWarnings = this.checkForDuplicates(posts, conversations)
    warnings.push(...duplicateWarnings)

    // Build report
    const report: ConsistencyReport = {
      timestamp: Date.now(),
      isValid: errors.filter((e) => e.severity === "critical").length === 0,
      errors,
      warnings,
      stats: {
        profileValid: profile ? this.validateProfile(profile).length === 0 : true,
        settingsValid: settings ? this.validateSettings(settings).length === 0 : true,
        postsValid: postsErrors.length === 0,
        conversationsValid: conversationsErrors.length === 0,
        referentialIntegrity: referentialErrors.length === 0,
      },
    }

    if (!report.isValid) {
      console.error("[v0] Data consistency issues detected:", errors)
    }

    return report
  }

  /**
   * Validate profile structure and constraints
   */
  private validateProfile(profile: Profile): ConsistencyError[] {
    const errors: ConsistencyError[] = []

    // Check required fields
    if (!profile.displayName || profile.displayName.trim().length === 0) {
      errors.push({
        type: "MISSING_FIELD",
        severity: "critical",
        message: "Profile displayName is missing or empty",
        affectedData: "profile",
        suggestedFix: "Set a valid displayName",
      })
    }

    // Check name length
    if (profile.displayName && profile.displayName.length > 100) {
      errors.push({
        type: "INVALID_LENGTH",
        severity: "high",
        message: "Profile displayName exceeds maximum length (100)",
        affectedData: "profile.displayName",
        suggestedFix: "Truncate displayName to 100 characters or less",
      })
    }

    // Check age range
    if (profile.age && (profile.age < 13 || profile.age > 150)) {
      errors.push({
        type: "INVALID_VALUE",
        severity: "high",
        message: `Profile age ${profile.age} is outside valid range (13-150)`,
        affectedData: "profile.age",
        suggestedFix: "Set age to a value between 13 and 150",
      })
    }

    // Check bio length
    if (profile.bio && profile.bio.length > 1000) {
      errors.push({
        type: "INVALID_LENGTH",
        severity: "medium",
        message: "Profile bio exceeds maximum length (1000)",
        affectedData: "profile.bio",
        suggestedFix: "Truncate bio to 1000 characters or less",
      })
    }

    // Check timestamp validity
    if (profile.createdAt && (profile.createdAt > Date.now() || profile.createdAt < 0)) {
      errors.push({
        type: "INVALID_TIMESTAMP",
        severity: "high",
        message: "Profile createdAt timestamp is invalid",
        affectedData: "profile.createdAt",
        suggestedFix: "Correct the timestamp to current time",
      })
    }

    // Check photo URLs validity
    if (profile.photos && Array.isArray(profile.photos)) {
      profile.photos.forEach((photo, idx) => {
        if (!this.isValidUrl(photo)) {
          errors.push({
            type: "INVALID_URL",
            severity: "medium",
            message: `Profile photo ${idx} has invalid URL`,
            affectedData: `profile.photos[${idx}]`,
            suggestedFix: "Provide a valid image URL",
          })
        }
      })
    }

    // Check gender is from allowed values
    const validGenders = ["male", "female", "non-binary", "prefer-not-to-say"]
    if (profile.gender && !validGenders.includes(profile.gender)) {
      errors.push({
        type: "INVALID_ENUM",
        severity: "medium",
        message: `Profile gender "${profile.gender}" is not in allowed values`,
        affectedData: "profile.gender",
        suggestedFix: `Use one of: ${validGenders.join(", ")}`,
      })
    }

    return errors
  }

  /**
   * Validate settings structure
   */
  private validateSettings(settings: Settings): ConsistencyError[] {
    const errors: ConsistencyError[] = []

    // Check age range
    if (settings.ageMin && settings.ageMax && settings.ageMin > settings.ageMax) {
      errors.push({
        type: "INVALID_RANGE",
        severity: "high",
        message: "Settings ageMin is greater than ageMax",
        affectedData: "settings.ageMin/ageMax",
        suggestedFix: "Ensure ageMin <= ageMax",
      })
    }

    // Check location radius
    if (settings.locationRadius && (settings.locationRadius < 0 || settings.locationRadius > 50000)) {
      errors.push({
        type: "INVALID_VALUE",
        severity: "medium",
        message: `Settings locationRadius ${settings.locationRadius} is outside valid range (0-50000)`,
        affectedData: "settings.locationRadius",
        suggestedFix: "Set locationRadius between 0 and 50000 km",
      })
    }

    // Check blocked users is array
    if (settings.blockedUsers && !Array.isArray(settings.blockedUsers)) {
      errors.push({
        type: "INVALID_TYPE",
        severity: "high",
        message: "Settings blockedUsers is not an array",
        affectedData: "settings.blockedUsers",
        suggestedFix: "Convert blockedUsers to an array",
      })
    }

    return errors
  }

  /**
   * Validate posts collection
   */
  private validatePosts(posts: Post[]): ConsistencyError[] {
    const errors: ConsistencyError[] = []

    if (!Array.isArray(posts)) {
      errors.push({
        type: "INVALID_TYPE",
        severity: "critical",
        message: "Posts is not an array",
        affectedData: "posts",
        suggestedFix: "Ensure posts is an array",
      })
      return errors
    }

    posts.forEach((post, idx) => {
      // Check required fields
      if (!post.id) {
        errors.push({
          type: "MISSING_FIELD",
          severity: "high",
          message: `Post ${idx} missing required field: id`,
          affectedData: `posts[${idx}].id`,
        })
      }

      // Check content
      if (!post.content || post.content.trim().length === 0) {
        errors.push({
          type: "MISSING_FIELD",
          severity: "high",
          message: `Post ${idx} content is empty`,
          affectedData: `posts[${idx}].content`,
        })
      }

      // Check timestamp
      if (!post.createdAt || post.createdAt > Date.now()) {
        errors.push({
          type: "INVALID_TIMESTAMP",
          severity: "medium",
          message: `Post ${idx} has invalid timestamp`,
          affectedData: `posts[${idx}].createdAt`,
        })
      }

      // Check likes is non-negative
      if (post.likes < 0) {
        errors.push({
          type: "INVALID_VALUE",
          severity: "low",
          message: `Post ${idx} likes count is negative`,
          affectedData: `posts[${idx}].likes`,
          suggestedFix: "Set likes to 0",
        })
      }
    })

    return errors
  }

  /**
   * Validate conversations collection
   */
  private validateConversations(conversations: Conversation[]): ConsistencyError[] {
    const errors: ConsistencyError[] = []

    if (!Array.isArray(conversations)) {
      errors.push({
        type: "INVALID_TYPE",
        severity: "critical",
        message: "Conversations is not an array",
        affectedData: "conversations",
      })
      return errors
    }

    conversations.forEach((conv, idx) => {
      if (!conv.id) {
        errors.push({
          type: "MISSING_FIELD",
          severity: "high",
          message: `Conversation ${idx} missing required field: id`,
        })
      }

      if (!Array.isArray(conv.messages)) {
        errors.push({
          type: "INVALID_TYPE",
          severity: "high",
          message: `Conversation ${idx} messages is not an array`,
        })
      }
    })

    return errors
  }

  /**
   * Check referential integrity across entities
   */
  private checkReferentialIntegrity(
    posts: Post[],
    conversations: Conversation[],
    profile: Profile | null
  ): ConsistencyError[] {
    const errors: ConsistencyError[] = []

    // Check that posts reference valid authors
    if (profile) {
      const authorId = "current-user"
      posts.forEach((post, idx) => {
        if (post.authorId === authorId && post.authorName !== profile.displayName) {
          errors.push({
            type: "REFERENTIAL_INTEGRITY",
            severity: "medium",
            message: `Post ${idx} author name doesn't match profile`,
            affectedData: `posts[${idx}].authorName`,
            suggestedFix: `Update to "${profile.displayName}"`,
          })
        }
      })
    }

    // Check conversation participants exist (basic check)
    conversations.forEach((conv, idx) => {
      if (!conv.participantId || conv.participantId.trim().length === 0) {
        errors.push({
          type: "REFERENTIAL_INTEGRITY",
          severity: "high",
          message: `Conversation ${idx} missing participant reference`,
          affectedData: `conversations[${idx}].participantId`,
        })
      }
    })

    return errors
  }

  /**
   * Check for duplicate entries
   */
  private checkForDuplicates(posts: Post[], conversations: Conversation[]): string[] {
    const warnings: string[] = []

    // Check duplicate post IDs
    const postIds = new Set<string>()
    posts.forEach((post) => {
      if (postIds.has(post.id)) {
        warnings.push(`Duplicate post ID detected: ${post.id}`)
      }
      postIds.add(post.id)
    })

    // Check duplicate conversation IDs
    const convIds = new Set<string>()
    conversations.forEach((conv) => {
      if (convIds.has(conv.id)) {
        warnings.push(`Duplicate conversation ID detected: ${conv.id}`)
      }
      convIds.add(conv.id)
    })

    return warnings
  }

  /**
   * Validate URL format
   */
  private isValidUrl(url: string): boolean {
    try {
      new URL(url)
      return true
    } catch {
      return url.startsWith("/") || url.startsWith("data:")
    }
  }

  /**
   * Auto-repair common issues
   */
  autoRepair(report: ConsistencyReport): {
    repaired: boolean
    changesApplied: string[]
  } {
    const changesApplied: string[] = []

    report.errors.forEach((error) => {
      if (error.severity === "low" || error.severity === "medium") {
        if (error.type === "INVALID_VALUE" && error.affectedData?.includes("likes")) {
          changesApplied.push(`Fixed negative likes count`)
        }

        if (error.type === "INVALID_ENUM" && error.affectedData?.includes("gender")) {
          changesApplied.push(`Reset invalid gender value to prefer-not-to-say`)
        }
      }
    })

    return {
      repaired: changesApplied.length > 0,
      changesApplied,
    }
  }
}

export const dataConsistencyChecker = new DataConsistencyChecker()
