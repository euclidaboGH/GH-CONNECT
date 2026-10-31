// Link Preview Service
// Extracts and manages link previews for posts and comments

import type { LinkPreview } from "@/lib/ghc-types"

export interface LinkPreviewCache {
  [url: string]: {
    preview: LinkPreview | null
    cachedAt: number
    expiresAt: number
  }
}

const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000 // 7 days in ms

// Simple link preview extraction (client-side)
export function extractLinkPreview(url: string): LinkPreview {
  try {
    const urlObj = new URL(url)

    // Get domain
    let domain = urlObj.hostname
    if (domain.startsWith("www.")) {
      domain = domain.substring(4)
    }

    return {
      url,
      title: getDomainTitle(domain),
      description: null,
      image: null,
      domain,
    }
  } catch {
    return {
      url,
      title: null,
      description: null,
      image: null,
      domain: url,
    }
  }
}

function getDomainTitle(domain: string): string {
  const commonDomains: Record<string, string> = {
    "youtube.com": "YouTube",
    "youtu.be": "YouTube",
    "twitter.com": "Twitter / X",
    "x.com": "Twitter / X",
    "github.com": "GitHub",
    "reddit.com": "Reddit",
    "medium.com": "Medium",
    "linkedin.com": "LinkedIn",
    "facebook.com": "Facebook",
    "instagram.com": "Instagram",
    "tiktok.com": "TikTok",
    "twitch.tv": "Twitch",
    "spotify.com": "Spotify",
    "wikipedia.org": "Wikipedia",
    "amazon.com": "Amazon",
    "ebay.com": "eBay",
    "news.google.com": "Google News",
    "bbc.com": "BBC News",
    "cnn.com": "CNN",
    "theguardian.com": "The Guardian",
  }

  return commonDomains[domain] || domain
}

// Get favicon URL for a domain
export function getFaviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}`
}

// Cache management (unified implementation)
export class LinkPreviewCacheImpl {
  private cache: Map<string, { preview: LinkPreview | null; expiresAt: number }> = new Map()

  set(url: string, preview: LinkPreview | null): void {
    this.cache.set(url, {
      preview,
      expiresAt: Date.now() + CACHE_DURATION,
    })
  }

  get(url: string): LinkPreview | null | undefined {
    const cached = this.cache.get(url)
    if (!cached) return undefined

    if (Date.now() > cached.expiresAt) {
      this.cache.delete(url)
      return undefined
    }

    return cached.preview
  }

  has(url: string): boolean {
    const cached = this.cache.get(url)
    if (!cached) return false

    if (Date.now() > cached.expiresAt) {
      this.cache.delete(url)
      return false
    }

    return true
  }

  clear(): void {
    this.cache.clear()
  }

  clearExpired(): void {
    const now = Date.now()
    for (const [url, data] of this.cache.entries()) {
      if (now > data.expiresAt) {
        this.cache.delete(url)
      }
    }
  }

  size(): number {
    return this.cache.size
  }
}

// Export singleton instance
export const LinkPreviewCache = new LinkPreviewCacheImpl()

// Link validation
export function isValidUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

export function isValidProtocol(url: string): boolean {
  try {
    const urlObj = new URL(url)
    return urlObj.protocol === "http:" || urlObj.protocol === "https:"
  } catch {
    return false
  }
}

// Link extraction
export function extractUrls(text: string): string[] {
  const urlPattern = /https?:\/\/[^\s]+/g
  const matches = text.match(urlPattern)
  if (!matches) return []

  return [...new Set(matches)] // Remove duplicates
}

// Safe link opening
export function openLink(url: string, target: "_blank" | "_self" = "_blank"): void {
  if (!isValidProtocol(url)) {
    console.warn("Invalid URL protocol:", url)
    return
  }

  window.open(url, target, "noopener,noreferrer")
}

// Analytics link wrapping (for tracking clicks)
export function wrapLinkForAnalytics(
  url: string,
  trackingParams?: Record<string, string>
): string {
  if (!isValidUrl(url)) return url

  try {
    const urlObj = new URL(url)

    if (trackingParams) {
      for (const [key, value] of Object.entries(trackingParams)) {
        urlObj.searchParams.set(key, value)
      }
    }

    return urlObj.toString()
  } catch {
    return url
  }
}

// Link shortening detection
export function isShortened(url: string): boolean {
  const shortenerPatterns = [
    /bit\.ly/,
    /tinyurl\.com/,
    /goo\.gl/,
    /ow\.ly/,
    /t\.co/,
    /short\.link/,
    /buff\.ly/,
    /adf\.ly/,
  ]

  return shortenerPatterns.some((pattern) => pattern.test(url))
}

// Link preview for common platforms
export function getPreviewForPlatform(url: string): Partial<LinkPreview> {
  const platform = getPlatformFromUrl(url)

  const previewData: Record<string, Partial<LinkPreview>> = {
    youtube: {
      title: "YouTube Video",
      description: "Watch on YouTube",
    },
    twitter: {
      title: "Tweet",
      description: "View on Twitter",
    },
    github: {
      title: "GitHub Repository",
      description: "View on GitHub",
    },
    linkedin: {
      title: "LinkedIn Post",
      description: "View on LinkedIn",
    },
    reddit: {
      title: "Reddit Post",
      description: "View on Reddit",
    },
    medium: {
      title: "Medium Article",
      description: "Read on Medium",
    },
    stackoverflow: {
      title: "Stack Overflow",
      description: "View on Stack Overflow",
    },
  }

  return previewData[platform] || {}
}

function getPlatformFromUrl(url: string): string {
  const platformPatterns: Record<string, string> = {
    youtube: "youtube.com|youtu.be",
    twitter: "twitter.com|x.com",
    github: "github.com",
    linkedin: "linkedin.com",
    reddit: "reddit.com",
    medium: "medium.com",
    stackoverflow: "stackoverflow.com",
  }

  for (const [platform, pattern] of Object.entries(platformPatterns)) {
    if (new RegExp(pattern).test(url)) {
      return platform
    }
  }

  return "unknown"
}

// Create shareable link preview
export function createShareablePreview(
  title: string,
  description: string,
  url: string,
  imageUrl?: string
): string {
  const preview = {
    title: title || "Check this out",
    description: description || url,
    url,
    image: imageUrl,
  }

  return JSON.stringify(preview)
}

// Link statistics
export interface LinkStats {
  url: string
  clickCount: number
  views: number
  shares: number
  firstSeen: number
  lastClicked?: number
}

export function createLinkStats(url: string): LinkStats {
  return {
    url,
    clickCount: 0,
    views: 0,
    shares: 0,
    firstSeen: Date.now(),
  }
}

export function recordLinkClick(stats: LinkStats): LinkStats {
  return {
    ...stats,
    clickCount: stats.clickCount + 1,
    lastClicked: Date.now(),
  }
}

export function recordLinkView(stats: LinkStats): LinkStats {
  return {
    ...stats,
    views: stats.views + 1,
  }
}

export function recordLinkShare(stats: LinkStats): LinkStats {
  return {
    ...stats,
    shares: stats.shares + 1,
  }
}
