// Post and Comment Validation Engine
// Comprehensive validation for posts, comments, and all attached content

export interface ValidationResult {
  valid: boolean
  error?: string
  warnings?: string[]
  sanitized?: string
}

export interface CommentValidation extends ValidationResult {
  mentions?: string[]
  hashtags?: string[]
  urls?: string[]
  emojis?: string[]
}

// Text validation and sanitization
export function validatePostContent(text: string, maxLength: number = 5000): ValidationResult {
  const trimmed = text.trim()
  if (!trimmed) {
    return { valid: false, error: "Post content cannot be empty" }
  }
  if (trimmed.length > maxLength) {
    return { valid: false, error: `Post exceeds ${maxLength} characters` }
  }
  return { valid: true, sanitized: sanitizeText(trimmed) }
}

export function validateCommentText(text: string, maxLength: number = 5000): ValidationResult {
  return validatePostContent(text, maxLength)
}

export function validateQuoteText(text: string, maxLength: number = 1000): ValidationResult {
  return validatePostContent(text, maxLength)
}

// Mention validation
export interface MentionValidation {
  valid: boolean
  mentions: string[]
  invalidMentions?: string[]
}

export function extractMentions(text: string): string[] {
  const mentionRegex = /@(\w+)/g
  const mentions: string[] = []
  let match
  while ((match = mentionRegex.exec(text)) !== null) {
    mentions.push(match[1])
  }
  return [...new Set(mentions)] // deduplicate
}

export function validateMentions(text: string, validUserIds: string[]): MentionValidation {
  const mentions = extractMentions(text)
  const validSet = new Set(validUserIds)
  const invalid = mentions.filter((m) => !validSet.has(m))

  return {
    valid: invalid.length === 0,
    mentions: mentions.filter((m) => validSet.has(m)),
    invalidMentions: invalid.length > 0 ? invalid : undefined,
  }
}

// Hashtag validation
export function extractHashtags(text: string): string[] {
  const hashtagRegex = /#(\w+)/g
  const hashtags: string[] = []
  let match
  while ((match = hashtagRegex.exec(text)) !== null) {
    hashtags.push(match[1].toLowerCase())
  }
  return [...new Set(hashtags)] // deduplicate
}

export function validateHashtags(text: string): { valid: boolean; hashtags: string[] } {
  const hashtags = extractHashtags(text)
  const maxHashtags = 30
  return {
    valid: hashtags.length <= maxHashtags,
    hashtags,
  }
}

// URL validation
export function extractUrls(text: string): string[] {
  const urlRegex = /(https?:\/\/[^\s]+)/g
  const urls: string[] = []
  let match
  while ((match = urlRegex.exec(text)) !== null) {
    try {
      new URL(match[1])
      urls.push(match[1])
    } catch {
      // Invalid URL, skip
    }
  }
  return [...new Set(urls)] // deduplicate
}

export function validateUrls(text: string): { valid: boolean; urls: string[]; invalid: string[] } {
  const potentialUrls = extractUrls(text)
  const invalid: string[] = []
  const valid: string[] = []

  for (const url of potentialUrls) {
    try {
      new URL(url)
      valid.push(url)
    } catch {
      invalid.push(url)
    }
  }

  return { valid: invalid.length === 0, urls: valid, invalid }
}

// Emoji validation
export function extractEmojis(text: string): string[] {
  // Match emoji sequences including skin tone modifiers and zero-width joiners
  const emojiRegex =
    /(\u00d83c[\udc00-\udfff]|\u00d83d[\udc00-\ude4f]|\u00d83d[\ude80-\udeff]|[\u2600-\u27BF]|[\u2300-\u23FF]|[\u2000-\u206F]|[\u2E00-\u2E7F])/g
  const emojis = text.match(emojiRegex) || []
  return [...new Set(emojis)]
}

export function validateEmojis(text: string): { valid: boolean; emojis: string[] } {
  const emojis = extractEmojis(text)
  const maxEmojis = 50
  return { valid: emojis.length <= maxEmojis, emojis }
}

export function validateReactionEmoji(emoji: string): boolean {
  // Only allow single emoji characters for reactions
  const singleEmojiRegex = /^(\u00d83c[\udc00-\udfff]|\u00d83d[\udc00-\ude4f]|[\u2600-\u27BF])$/
  return singleEmojiRegex.test(emoji)
}

// Image validation
export function validateImage(
  imageData: string,
  maxSizeMB: number = 10
): { valid: boolean; error?: string; sizeKB?: number } {
  if (!imageData) {
    return { valid: false, error: "Image data is required" }
  }

  if (!imageData.startsWith("data:image/")) {
    return { valid: false, error: "Invalid image format" }
  }

  const sizeInBytes = Math.ceil((imageData.length * 3) / 4)
  const sizeInKB = sizeInBytes / 1024
  const maxSizeBytes = maxSizeMB * 1024 * 1024

  if (sizeInBytes > maxSizeBytes) {
    return { valid: false, error: `Image exceeds ${maxSizeMB}MB limit`, sizeKB }
  }

  return { valid: true, sizeKB }
}

// GIF validation
export function validateGif(
  gifUrl: string,
  maxSizeMB: number = 15
): { valid: boolean; error?: string } {
  if (!gifUrl) {
    return { valid: false, error: "GIF URL is required" }
  }

  if (!gifUrl.includes(".gif")) {
    return { valid: false, error: "URL must be a GIF file" }
  }

  // In production, would check actual file size
  return { valid: true }
}

// Voice recording validation
export function validateVoiceRecording(
  voiceData: string,
  durationSeconds: number,
  maxDurationSeconds: number = 60
): { valid: boolean; error?: string } {
  if (!voiceData) {
    return { valid: false, error: "Voice recording data is required" }
  }

  if (durationSeconds <= 0) {
    return { valid: false, error: "Voice recording duration must be positive" }
  }

  if (durationSeconds > maxDurationSeconds) {
    return { valid: false, error: `Voice recording exceeds ${maxDurationSeconds} seconds` }
  }

  return { valid: true }
}

// Media attachment validation
export interface AttachmentValidation {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export function validateAttachments(
  attachments: Array<{ type: string; data?: string; url?: string; duration?: number }>
): AttachmentValidation {
  const errors: string[] = []
  const warnings: string[] = []
  const maxAttachments = 10

  if (attachments.length > maxAttachments) {
    errors.push(`Cannot attach more than ${maxAttachments} files`)
  }

  for (let i = 0; i < attachments.length; i++) {
    const attachment = attachments[i]

    switch (attachment.type) {
      case "image":
        if (attachment.data) {
          const imgValidation = validateImage(attachment.data)
          if (!imgValidation.valid) {
            errors.push(`Image ${i + 1}: ${imgValidation.error}`)
          }
        }
        break
      case "gif":
        if (attachment.url) {
          const gifValidation = validateGif(attachment.url)
          if (!gifValidation.valid) {
            errors.push(`GIF ${i + 1}: ${gifValidation.error}`)
          }
        }
        break
      case "voice":
        if (attachment.data && attachment.duration) {
          const voiceValidation = validateVoiceRecording(attachment.data, attachment.duration)
          if (!voiceValidation.valid) {
            errors.push(`Voice ${i + 1}: ${voiceValidation.error}`)
          }
        }
        break
      default:
        warnings.push(`Unknown attachment type: ${attachment.type}`)
    }
  }

  return { valid: errors.length === 0, errors, warnings }
}

// Comprehensive comment validation
export function validateCommentFull(
  text: string,
  options: {
    maxLength?: number
    checkMentions?: boolean
    checkHashtags?: boolean
    checkUrls?: boolean
    checkEmojis?: boolean
    checkAttachments?: boolean
    validUserIds?: string[]
    attachments?: Array<any>
  } = {}
): CommentValidation {
  const maxLength = options.maxLength || 5000

  // Basic text validation
  const textValidation = validateCommentText(text, maxLength)
  if (!textValidation.valid) {
    return { ...textValidation }
  }

  const result: CommentValidation = {
    valid: true,
    sanitized: textValidation.sanitized,
    warnings: [],
  }

  // Extract and validate mentions
  if (options.checkMentions) {
    const mentions = extractMentions(text)
    result.mentions = mentions
    if (options.validUserIds) {
      const mentionValidation = validateMentions(text, options.validUserIds)
      if (!mentionValidation.valid && mentionValidation.invalidMentions) {
        result.warnings!.push(`Invalid mentions: ${mentionValidation.invalidMentions.join(", ")}`)
      }
    }
  }

  // Extract and validate hashtags
  if (options.checkHashtags) {
    const hashtagValidation = validateHashtags(text)
    result.hashtags = hashtagValidation.hashtags
    if (!hashtagValidation.valid) {
      result.warnings!.push("Too many hashtags")
      result.valid = false
    }
  }

  // Extract and validate URLs
  if (options.checkUrls) {
    const urlValidation = validateUrls(text)
    result.urls = urlValidation.urls
    if (!urlValidation.valid) {
      result.warnings!.push(`Invalid URLs: ${urlValidation.invalid.join(", ")}`)
    }
  }

  // Extract and validate emojis
  if (options.checkEmojis) {
    const emojiValidation = validateEmojis(text)
    result.emojis = emojiValidation.emojis
    if (!emojiValidation.valid) {
      result.warnings!.push("Too many emojis")
      result.valid = false
    }
  }

  // Validate attachments
  if (options.checkAttachments && options.attachments) {
    const attachmentValidation = validateAttachments(options.attachments)
    if (!attachmentValidation.valid) {
      result.valid = false
      result.warnings!.push(...attachmentValidation.errors)
    }
    result.warnings!.push(...attachmentValidation.warnings)
  }

  return result.warnings!.length === 0 ? { ...result, warnings: undefined } : result
}

// Text sanitization
export function sanitizeText(text: string): string {
  return text
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;")
    .replace(/\n{3,}/g, "\n\n") // Limit consecutive newlines
}

export function sanitizeForDisplay(text: string): string {
  // Allow safe HTML entities but prevent XSS
  return sanitizeText(text)
}

// Spam detection patterns
const SPAM_PATTERNS = [
  /(?:(?:viagra|cialis|casino|lottery|prize).*?){3}/gi,
  /(?:click here|buy now|limited offer).*?{3}/gi,
  /\$\d{2,}/g, // Suspicious price mentions
  /(?:@\w+\s*){10,}/g, // Excessive mentions
  /(?:#\w+\s*){20,}/g, // Excessive hashtags
  /(.)\1{10,}/g, // Repeated characters
]

export function detectSpam(text: string): { isSpam: boolean; patterns: string[] } {
  const matchedPatterns: string[] = []

  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(text)) {
      matchedPatterns.push(pattern.source)
    }
  }

  return { isSpam: matchedPatterns.length > 0, patterns: matchedPatterns }
}
