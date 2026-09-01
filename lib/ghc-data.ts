import type { Profile, Settings, Candidate, Post, StoryItem } from "./ghc-types"

// Storage keys
export const STORAGE_KEYS = {
  profile: "ghc.profile",
  settings: "ghc.settings",
  posts: "ghc.posts",
  matches: "ghc.matches",
  likes: "ghc.likes",
  conversations: "ghc.conversations",
  friendRequests: "ghc.friend-requests",
  stories: "ghc.stories",
  /** Social graph — survive refresh within Studio / Pi storage */
  following: "ghc.following",
  friends: "ghc.friends",
  blockedUsers: "ghc.blocked-users",
  mutedUsers: "ghc.muted-users",
}

// Interests
export const INTERESTS = {
  hobbies: ["Music", "Sports", "Travel", "Reading", "Gaming", "Cooking", "Photography", "Fitness", "Fashion", "Food"],
  professional: ["Tech", "Finance", "Healthcare", "Education", "Arts", "Entrepreneurship"],
  lifestyle: ["Wellness", "Nature", "Volunteering", "Pets", "Spirituality", "Writing"],
}

export const ALL_INTERESTS = [...INTERESTS.hobbies, ...INTERESTS.professional, ...INTERESTS.lifestyle]

export function seedStories(): StoryItem[] {
  const now = Date.now()
  return [
    { id: "story-sarah", ownerId: "cand-1", name: "Sarah", photo: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah&size=128", text: "Morning coffee vibes", createdAt: now - 3600000 },
    { id: "story-emma", ownerId: "cand-2", name: "Emma", photo: "https://api.dicebear.com/7.x/avataaars/svg?seed=Emma&size=128", text: "Studio day", createdAt: now - 7200000 },
    { id: "story-jessica", ownerId: "cand-3", name: "Jessica", photo: "https://api.dicebear.com/7.x/avataaars/svg?seed=Jessica&size=128", text: "Shipping something new", createdAt: now - 10800000 },
  ]
}

const STORY_MEDIA_MAX_BYTES = 48_000

function boundedStoryText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.replace(/[\u0000-\u001F\u007F]/g, "").slice(0, maxLength) : ""
}

export function sanitizeStory(value: unknown): StoryItem | null {
  if (!value || typeof value !== "object") return null
  const raw = value as Partial<StoryItem>
  const id = boundedStoryText(raw.id, 80)
  const name = boundedStoryText(raw.name, 80)
  const createdAt = typeof raw.createdAt === "number" && Number.isFinite(raw.createdAt) ? raw.createdAt : 0
  if (!id || !name || createdAt <= 0) return null

  const media = raw.media && (raw.media.type === "image" || raw.media.type === "video") && typeof raw.media.url === "string" && raw.media.url.length <= STORY_MEDIA_MAX_BYTES
    ? { type: raw.media.type, url: raw.media.url }
    : null

  return {
    id,
    ownerId: typeof raw.ownerId === "string" ? boundedStoryText(raw.ownerId, 80) : undefined,
    name,
    photo: typeof raw.photo === "string" && raw.photo.length <= STORY_MEDIA_MAX_BYTES ? raw.photo : undefined,
    text: boundedStoryText(raw.text, 500),
    media,
    createdAt,
  }
}

export function sanitizeStories(value: unknown): StoryItem[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  return value
    .map(sanitizeStory)
    .filter((story): story is StoryItem => Boolean(story) && !seen.has(story.id) && seen.add(story.id))
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 50)
}

// Default profile
export function defaultProfile(): Profile {
  return {
    displayName: "User",
    age: 25,
    gender: "prefer-not-to-say",
    city: "",
    country: "",
    bio: "",
    primaryMode: "dating",
    interests: [],
    photos: [],
    coverPhoto: null,
    status: "",
    profession: "",
    bornDate: "",
    hometown: "",
    education: "",
    verified: false,
    onboarded: false,
    createdAt: Date.now(),
  }
}

// Default settings
export const DEFAULT_SETTINGS: Settings = {
  darkMode: false,
  themeMode: "light",
  themeId: "gh-classic",
  themeCustomImage: null,
  themeImageOpacity: 0.35,
  language: "English",
  onlineStatus: "everyone",
  whoCanMessage: "everyone",
  profileVisibility: "everyone",
  storyVisibility: "everyone",
  whoCanDiscover: "everyone",
  whoCanFollow: "everyone",
  whoCanConnect: "everyone",
  showActivity: true,
  showInterests: true,
  showCommunities: true,
  showLocation: true,
  locationRadius: 50,
  ageMin: 18,
  ageMax: 45,
  genderPref: ["Everyone"],
  relationshipType: ["dating"],
  blockedUsers: [],
  moderationReports: [],
  notifyMatches: true,
  notifyMessages: true,
  notifyRewards: true,
  notifyMembership: true,
  notifyProfileViews: false,
  notifyMarketing: false,
}

// Seed candidates for discovery
export function seedCandidates(): Candidate[] {
  const now = Date.now()
  const candidates: Candidate[] = [
    {
      id: "cand-1",
      name: "Sarah",
      age: 26,
      location: "Lagos, Nigeria",
      bio: "Adventure seeker, love travel and photography 📸",
      photo: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah&size=256",
      interests: ["Travel", "Photography", "Tech"],
      verified: true,
      online: true,
      lastSeen: now,
    },
    {
      id: "cand-2",
      name: "Emma",
      age: 24,
      location: "Abuja, Nigeria",
      bio: "Artist and coffee lover ☕",
      photo: "https://api.dicebear.com/7.x/avataaars/svg?seed=Emma&size=256",
      interests: ["Arts", "Food", "Wellness"],
      verified: false,
      online: false,
      lastSeen: now - 3600000,
    },
    {
      id: "cand-3",
      name: "Jessica",
      age: 28,
      location: "Accra, Ghana",
      bio: "Entrepreneur building fintech. Let's connect!",
      photo: "https://api.dicebear.com/7.x/avataaars/svg?seed=Jessica&size=256",
      interests: ["Tech", "Entrepreneurship", "Finance"],
      verified: true,
      online: true,
      lastSeen: now,
    },
    {
      id: "cand-4",
      name: "Nicole",
      age: 25,
      location: "Nairobi, Kenya",
      bio: "Fitness enthusiast & yoga instructor",
      photo: "https://api.dicebear.com/7.x/avataaars/svg?seed=Nicole&size=256",
      interests: ["Fitness", "Wellness", "Nature"],
      verified: false,
      online: true,
      lastSeen: now,
    },
    {
      id: "cand-5",
      name: "Zainab",
      age: 27,
      location: "Cairo, Egypt",
      bio: "Teacher, bookworm, love meaningful conversations",
      photo: "https://api.dicebear.com/7.x/avataaars/svg?seed=Zainab&size=256",
      interests: ["Education", "Reading", "Writing"],
      verified: true,
      online: false,
      lastSeen: now - 7200000,
    },
    {
      id: "cand-6",
      name: "David",
      age: 29,
      location: "Cape Town, South Africa",
      bio: "Software engineer. Open to friendship and networking.",
      photo: "https://api.dicebear.com/7.x/avataaars/svg?seed=David&size=256",
      interests: ["Tech", "Gaming", "Music"],
      verified: true,
      online: true,
      lastSeen: now,
    },
    {
      id: "cand-7",
      name: "Amina",
      age: 23,
      location: "Kano, Nigeria",
      bio: "Student, love languages and culture.",
      photo: "https://api.dicebear.com/7.x/avataaars/svg?seed=Amina&size=256",
      interests: ["Education", "Travel", "Reading"],
      verified: false,
      online: true,
      lastSeen: now - 1800000,
    },
    {
      id: "cand-8",
      name: "Kwame",
      age: 31,
      location: "Kumasi, Ghana",
      bio: "Business owner. Looking for meaningful connections.",
      photo: "https://api.dicebear.com/7.x/avataaars/svg?seed=Kwame&size=256",
      interests: ["Entrepreneurship", "Sports", "Food"],
      verified: true,
      online: false,
      lastSeen: now - 86400000,
    },
  ]
  return candidates
}

// Seed posts for home feed
export function seedPosts(): Post[] {
  return [
    {
      id: "post-current-1",
      authorId: "current-user",
      authorName: "You",
      authorPhoto: "/placeholder.svg?width=40&height=40",
      content: "Just got back from this amazing trip to the mountains! The views were breathtaking 🏔️",
      images: ["/placeholder.svg?width=300&height=250"],
      video: null,
      pdf: null,
      pdfName: null,
      likes: 12,
      comments: [{ id: "c1", authorName: "Emma L.", authorPhoto: "/placeholder.svg?width=32&height=32", text: "Looks amazing!", createdAt: Date.now() - 600000 }],
      createdAt: Date.now() - 3600000,
    },
    {
      id: "post-1",
      authorId: "cand-1",
      authorName: "Sarah",
      authorPhoto: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah&size=128",
      content: "Morning coffee and a good book. Can't ask for more! ☕📖",
      images: ["/placeholder.svg?width=300&height=250"],
      video: null,
      pdf: null,
      pdfName: null,
      likes: 24,
      comments: [],
      createdAt: Date.now() - 5400000,
    },
    {
      id: "post-2",
      authorId: "cand-2",
      authorName: "Emma",
      authorPhoto: "https://api.dicebear.com/7.x/avataaars/svg?seed=Emma&size=128",
      content: "Started a new project this week. Really excited about where this is heading!",
      images: [],
      video: null,
      pdf: null,
      pdfName: null,
      likes: 8,
      comments: [],
      createdAt: Date.now() - 7200000,
    },
    {
      id: "post-3",
      authorId: "cand-3",
      authorName: "Jessica",
      authorPhoto: "https://api.dicebear.com/7.x/avataaars/svg?seed=Jessica&size=128",
      content: "Excited to announce we just hit 1M users on our app! Thank you all for the support 🎉",
      images: [],
      video: null,
      pdf: null,
      pdfName: null,
      likes: 45,
      comments: [],
      createdAt: Date.now() - 10800000,
    },
  ]
}

// Utility functions
export function timeAgo(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) return "now"
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`

  const date = new Date(timestamp)
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 11)
}

/** @deprecated Prefer purpose-aware helpers from @/lib/media/compress-image */
export {
  compressImage,
  compressImageFile,
  compressForAvatar,
  compressForCover,
  compressForFeed,
  compressForTheme,
  compressForMessage,
} from "@/lib/media/compress-image"

export const LANGUAGES = ["English", "Spanish", "French", "German", "Portuguese", "Arabic", "Hindi", "Chinese"]

export const SUPPORT_CONTACTS = {
  whatsapp: "+2348143225421",
  facebook: "https://www.facebook.com/GreenHavenXpres",
  email: "support@ghconnect.com",
}

// Privacy settings utilities
export function shouldShowLocation(profileVisibility: string, myVisibility: string): boolean {
  if (profileVisibility === "everyone") return true
  if (profileVisibility === "hidden") return false
  return myVisibility === "matches-only" // Matches only see if both match
}

export function shouldShowOnlineStatus(onlineStatus: string, isMatched: boolean): boolean {
  if (onlineStatus === "everyone") return true
  if (onlineStatus === "hidden") return false
  if (onlineStatus === "matches-only" && isMatched) return true
  return false
}

export function getVisibleUserDetails(candidate: Candidate, userSettings: Settings, isMatched: boolean = false) {
  return {
    name: candidate.name, // Always show name
    age: candidate.age, // Always show age
    photo: candidate.photo, // Always show photo
    bio: candidate.bio, // Always show bio in discovery
    interests: candidate.interests, // Always show interests
    location: userSettings.profileVisibility === "hidden" ? "Hidden" : candidate.location,
    online: shouldShowOnlineStatus(userSettings.onlineStatus, isMatched),
    verified: candidate.verified, // Verified status always shown
  }
}

// Legal content
export const LEGAL = {
  about: `Welcome to GreenHaven — a global community built on genuine connections.

GreenHaven (GreenHaven Connect) was created with a simple belief: meaningful relationships should know no borders. Whether you're looking for friendship, dating, professional networking, or something in between, our platform brings together people from every corner of the world in a safe, respectful, and inclusive environment.

Our Mission: To empower individuals to form authentic connections across cultures, interests, and backgrounds — fostering relationships that enrich lives and broaden horizons.

Our Values:
• Safety First: Every feature prioritizes your security and privacy
• Authenticity: We celebrate genuine connections and verified profiles
• Inclusivity: Everyone is welcome regardless of background, gender, or orientation
• Respect: We maintain a culture of kindness and mutual respect
• Transparency: We are open about how your data is used and protected`,

  terms: `Terms of Service - GreenHaven

1. Acceptance of Terms
By using GreenHaven, you accept these terms and our privacy policy.

2. User Conduct
You agree to:
- Be at least 18 years old
- Provide accurate information
- Respect other users
- Not engage in harassment or abuse
- Not share explicit content
- Follow all applicable laws

3. Account Responsibility
You are responsible for maintaining your account security and all activities under your account.

4. User Content
You retain all rights to content you post. By posting, you grant GreenHaven a license to use that content.

5. Limitations of Liability
GreenHaven is provided "as is". We are not liable for indirect damages or issues arising from third-party content.

6. Termination
We reserve the right to terminate accounts that violate these terms.

7. Changes to Terms
We may update these terms at any time with notice to users.`,

  privacy: `Privacy Policy - GreenHaven

1. Information We Collect
- Account information (name, age, location)
- Profile content (photos, bio, interests)
- Interaction data (matches, messages, likes)
- Device information (IP, device type, operating system)
- Usage data (features used, time spent)

2. How We Use Information
- To provide and improve our service
- To personalize your experience
- To communicate with you
- To detect and prevent fraud
- To comply with legal obligations

3. Data Security
We use industry-standard encryption and security measures to protect your data.

4. Your Rights
You can:
- Access your personal data
- Request corrections
- Download your data
- Delete your account and associated data
- Opt out of marketing communications

5. Third-Party Sharing
We do not sell your data. We only share with:
- Service providers (hosting, analytics)
- Legal authorities when required
- Other users (as you authorize)

6. Data Retention
We retain your data as long as your account is active, then delete it within 90 days of deletion.

7. Contact
For privacy questions, email support@ghconnect.com`,
}


/**
 * Studio / local reciprocal interests so mutual Match can form when the user
 * expresses interest back. Never creates a Match by itself.
 * Only a subset of candidates "liked" the current user.
 */
export function seedReciprocalInterests(
  candidates: { id: string }[],
  currentUserId = "current-user",
): import("./ghc-types").Like[] {
  const now = Date.now()
  const likes: import("./ghc-types").Like[] = []
  candidates.forEach((c, index) => {
    // Every other candidate has already expressed interest (mutual when user likes)
    if (index % 2 === 0 && c.id && c.id !== currentUserId) {
      likes.push({
        id: `seed-like-in-${c.id}`,
        fromUserId: c.id,
        toUserId: currentUserId,
        createdAt: now - (index + 1) * 60000,
      })
    }
  })
  return likes
}
