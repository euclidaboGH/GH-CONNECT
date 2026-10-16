/**
 * GreenHaven Ecosystem service registry — single source of truth for the
 * service directory UI. Lightweight metadata only; heavy screens stay lazy.
 *
 * Status:
 *   ACTIVE       — real surface exists; openService navigates
 *   BETA         — real surface with Beta badge
 *   COMING_SOON  — informational landing only
 *   UNAVAILABLE  — disabled
 */

export type ServiceStatus = "ACTIVE" | "BETA" | "COMING_SOON" | "UNAVAILABLE"

export type ServiceCategoryId =
  | "social"
  | "commerce"
  | "education"
  | "transport"
  | "hospitality"
  | "finance"
  | "charity"
  | "media"
  | "ai"

export type ServiceDestination =
  | { kind: "tab"; tab: "home" | "discover" | "matches" | "communities" | "messages" | "profile" }
  | {
      kind: "overlay"
      overlay:
        | "wallet"
        | "rewards"
        | "settings"
        | "membership"
        | "help"
        | "ecosystem"
        | "marketplace"
        | "create"
    }
  | { kind: "focus"; serviceId: string }
  | { kind: "none" }

export type EcosystemService = {
  id: string
  /** Display name */
  title: string
  category: ServiceCategoryId
  /** Lucide icon key resolved in UI */
  icon: string
  description: string
  status: ServiceStatus
  destination: ServiceDestination
  keywords: string[]
  featured?: boolean
  /** Optional short badge override (e.g. "New") */
  badge?: string
  roadmapNote?: string
}

export type ServiceCategoryMeta = {
  id: ServiceCategoryId
  label: string
  order: number
}

export const SERVICE_CATEGORIES: readonly ServiceCategoryMeta[] = [
  { id: "social", label: "Social", order: 1 },
  { id: "commerce", label: "Commerce", order: 2 },
  { id: "education", label: "Education", order: 3 },
  { id: "transport", label: "Transport & Logistics", order: 4 },
  { id: "hospitality", label: "Hospitality", order: 5 },
  { id: "finance", label: "Finance & Rewards", order: 6 },
  { id: "charity", label: "Charity & Impact", order: 7 },
  { id: "media", label: "Media & Entertainment", order: 8 },
  { id: "ai", label: "AI & Intelligence", order: 9 },
] as const

export const ECOSYSTEM_SERVICES: readonly EcosystemService[] = [
  // Social
  {
    id: "community",
    title: "Community",
    category: "social",
    icon: "Users",
    description: "Boards, events, roles, and chapters",
    status: "ACTIVE",
    destination: { kind: "tab", tab: "communities" },
    keywords: ["community", "groups", "boards", "chapters"],
    featured: true,
  },
  {
    id: "gh-chat",
    title: "GH Chat",
    category: "social",
    icon: "MessageCircle",
    description: "Direct messages and group conversations",
    status: "ACTIVE",
    destination: { kind: "tab", tab: "messages" },
    keywords: ["chat", "messages", "dm", "inbox", "messaging"],
    featured: true,
  },
  {
    id: "connections",
    title: "Connections",
    category: "social",
    icon: "Users",
    description: "People you know and connection requests",
    status: "ACTIVE",
    destination: { kind: "tab", tab: "matches" },
    keywords: ["connections", "friends", "network"],
  },
  {
    id: "matches",
    title: "Matches",
    category: "social",
    icon: "Heart",
    description: "Match and connect with pioneers",
    status: "ACTIVE",
    destination: { kind: "tab", tab: "matches" },
    keywords: ["matches", "dating", "connect"],
  },
  {
    id: "events",
    title: "Events",
    category: "social",
    icon: "Sparkles",
    description: "Community and city events",
    status: "COMING_SOON",
    destination: { kind: "none" },
    keywords: ["events", "meetup", "rsvp"],
    roadmapNote: "RSVP and local event discovery are on the roadmap.",
  },

  // Commerce
  {
    id: "marketplace",
    title: "Marketplace",
    category: "commerce",
    icon: "ShoppingBag",
    description: "Buy & sell — listings, orders, Pay with π or GHC",
    status: "ACTIVE",
    destination: { kind: "overlay", overlay: "marketplace" },
    keywords: ["marketplace", "shop", "buy", "sell", "listings"],
    featured: true,
  },
  {
    id: "seller-centre",
    title: "Seller Centre",
    category: "commerce",
    icon: "ShoppingBag",
    description: "Manage listings, inventory, and orders",
    status: "COMING_SOON",
    destination: { kind: "none" },
    keywords: ["seller", "inventory", "store"],
    roadmapNote: "Seller tools will connect to your existing marketplace listings.",
  },
  {
    id: "orders",
    title: "Orders",
    category: "commerce",
    icon: "ShoppingBag",
    description: "Track purchases and sales",
    status: "ACTIVE",
    destination: { kind: "overlay", overlay: "marketplace" },
    keywords: ["orders", "purchases"],
  },
  {
    id: "services-ip",
    title: "Services",
    category: "commerce",
    icon: "Landmark",
    description: "Platform and professional services",
    status: "COMING_SOON",
    destination: { kind: "none" },
    keywords: ["services", "professional"],
    roadmapNote: "Service listings are planned for a later release.",
  },
  {
    id: "intellectual-marketplace",
    title: "Intellectual Marketplace",
    category: "commerce",
    icon: "Landmark",
    description: "Digital products and IP",
    status: "COMING_SOON",
    destination: { kind: "none" },
    keywords: ["ip", "digital", "intellectual"],
    roadmapNote: "IP and digital product listings are planned.",
  },

  // Education
  {
    id: "education",
    title: "GH Education",
    category: "education",
    icon: "GraduationCap",
    description: "Skills, mentorship, and GreenHaven knowledge",
    status: "COMING_SOON",
    destination: { kind: "none" },
    keywords: ["education", "learn", "courses", "school"],
    featured: true,
    roadmapNote: "Learning paths and mentorship are on the roadmap.",
  },
  {
    id: "primary-edu",
    title: "Primary",
    category: "education",
    icon: "GraduationCap",
    description: "Foundational learning tracks",
    status: "COMING_SOON",
    destination: { kind: "none" },
    keywords: ["primary"],
    roadmapNote: "Coming with the GH Education launch.",
  },
  {
    id: "secondary-edu",
    title: "Secondary",
    category: "education",
    icon: "GraduationCap",
    description: "Intermediate programmes",
    status: "COMING_SOON",
    destination: { kind: "none" },
    keywords: ["secondary"],
    roadmapNote: "Coming with the GH Education launch.",
  },
  {
    id: "tertiary-edu",
    title: "Tertiary",
    category: "education",
    icon: "GraduationCap",
    description: "Advanced and professional tracks",
    status: "COMING_SOON",
    destination: { kind: "none" },
    keywords: ["tertiary", "university"],
    roadmapNote: "Coming with the GH Education launch.",
  },
  {
    id: "scholars-hub",
    title: "GH Scholars Hub",
    category: "education",
    icon: "GraduationCap",
    description: "Scholar community and research",
    status: "COMING_SOON",
    destination: { kind: "none" },
    keywords: ["scholars", "research"],
    roadmapNote: "Scholar programmes are planned.",
  },
  {
    id: "courses",
    title: "Courses",
    category: "education",
    icon: "GraduationCap",
    description: "Structured courses and certificates",
    status: "COMING_SOON",
    destination: { kind: "none" },
    keywords: ["courses", "certificate"],
    roadmapNote: "Course catalogue will open with GH Education.",
  },

  // Transport
  {
    id: "transport",
    title: "Transport",
    category: "transport",
    icon: "Bus",
    description: "Mobility across the GreenHaven network",
    status: "COMING_SOON",
    destination: { kind: "none" },
    keywords: ["transport", "mobility", "travel"],
    featured: true,
    roadmapNote: "Road, rail, air, and sea mobility services are planned.",
  },
  {
    id: "road",
    title: "Road",
    category: "transport",
    icon: "Bus",
    description: "Road passenger and cargo",
    status: "COMING_SOON",
    destination: { kind: "none" },
    keywords: ["road", "taxi", "bus"],
    roadmapNote: "Road mobility is on the transport roadmap.",
  },
  {
    id: "rail",
    title: "Rail",
    category: "transport",
    icon: "Bus",
    description: "Rail passenger and freight",
    status: "COMING_SOON",
    destination: { kind: "none" },
    keywords: ["rail", "train"],
    roadmapNote: "Rail services are planned.",
  },
  {
    id: "air",
    title: "Air",
    category: "transport",
    icon: "Bus",
    description: "Air travel coordination",
    status: "COMING_SOON",
    destination: { kind: "none" },
    keywords: ["air", "flight"],
    roadmapNote: "Air mobility is planned.",
  },
  {
    id: "sea",
    title: "Sea",
    category: "transport",
    icon: "Bus",
    description: "Sea passenger and cargo",
    status: "COMING_SOON",
    destination: { kind: "none" },
    keywords: ["sea", "ship", "ferry"],
    roadmapNote: "Sea logistics are planned.",
  },
  {
    id: "logistics",
    title: "Logistics",
    category: "transport",
    icon: "Bus",
    description: "Cargo and supply-chain coordination",
    status: "COMING_SOON",
    destination: { kind: "none" },
    keywords: ["logistics", "cargo", "freight"],
    roadmapNote: "Logistics tools are on the roadmap.",
  },

  // Hospitality
  {
    id: "hotels",
    title: "Hotels",
    category: "hospitality",
    icon: "Landmark",
    description: "Stay and accommodation discovery",
    status: "COMING_SOON",
    destination: { kind: "none" },
    keywords: ["hotels", "stay", "accommodation"],
    featured: true,
    roadmapNote: "Hotel and accommodation booking is planned.",
  },
  {
    id: "accommodation",
    title: "Accommodation",
    category: "hospitality",
    icon: "Landmark",
    description: "Short and long stays",
    status: "COMING_SOON",
    destination: { kind: "none" },
    keywords: ["accommodation", "rental"],
    roadmapNote: "Accommodation listings are planned.",
  },
  {
    id: "reservations",
    title: "Reservations",
    category: "hospitality",
    icon: "Landmark",
    description: "Book and manage stays",
    status: "COMING_SOON",
    destination: { kind: "none" },
    keywords: ["reservations", "booking"],
    roadmapNote: "Reservation management is planned.",
  },
  {
    id: "travel",
    title: "Travel",
    category: "hospitality",
    icon: "Landmark",
    description: "Trip planning and experiences",
    status: "COMING_SOON",
    destination: { kind: "none" },
    keywords: ["travel", "trips"],
    roadmapNote: "Travel planning is on the roadmap.",
  },

  // Finance & Rewards
  {
    id: "wallet",
    title: "Wallet",
    category: "finance",
    icon: "Wallet",
    description: "GHC balance, transfers, and ledger",
    status: "ACTIVE",
    destination: { kind: "overlay", overlay: "wallet" },
    keywords: ["wallet", "balance", "transfer", "ledger"],
    featured: true,
  },
  {
    id: "ghc",
    title: "GHC",
    category: "finance",
    icon: "Coins",
    description: "GreenHaven utility — earn and spend inside the app",
    status: "ACTIVE",
    destination: { kind: "overlay", overlay: "wallet" },
    keywords: ["ghc", "utility", "coin", "token"],
  },
  {
    id: "pi-payments",
    title: "Pi Payments",
    category: "finance",
    icon: "Coins",
    description: "Verified π payments in Pi Browser",
    status: "ACTIVE",
    destination: { kind: "overlay", overlay: "wallet" },
    keywords: ["pi", "payments", "pay"],
  },
  {
    id: "rewards",
    title: "Rewards",
    category: "finance",
    icon: "Gift",
    description: "Earn GHC through participation",
    status: "ACTIVE",
    destination: { kind: "overlay", overlay: "rewards" },
    keywords: ["rewards", "earn", "daily", "xp"],
  },
  {
    id: "membership",
    title: "Membership",
    category: "finance",
    icon: "Crown",
    description: "VIP tiers, boosts, and entitlements",
    status: "ACTIVE",
    destination: { kind: "overlay", overlay: "membership" },
    keywords: ["membership", "vip", "premium"],
  },

  // Charity
  {
    id: "charity",
    title: "Charity",
    category: "charity",
    icon: "HeartHandshake",
    description: "Causes and transparent contributions",
    status: "COMING_SOON",
    destination: { kind: "none" },
    keywords: ["charity", "give", "donate"],
    roadmapNote: "Transparent giving and cause pages are planned.",
  },
  {
    id: "causes",
    title: "Causes",
    category: "charity",
    icon: "HeartHandshake",
    description: "Discover impact projects",
    status: "COMING_SOON",
    destination: { kind: "none" },
    keywords: ["causes", "impact"],
    roadmapNote: "Cause discovery is on the roadmap.",
  },
  {
    id: "donations",
    title: "Donations",
    category: "charity",
    icon: "HeartHandshake",
    description: "Contribute with π or GHC when available",
    status: "COMING_SOON",
    destination: { kind: "none" },
    keywords: ["donations", "contribute"],
    roadmapNote: "Donation flows will reuse existing payment rails when ready.",
  },
  {
    id: "community-projects",
    title: "Community projects",
    category: "charity",
    icon: "HeartHandshake",
    description: "Local impact initiatives",
    status: "COMING_SOON",
    destination: { kind: "none" },
    keywords: ["projects", "local", "impact"],
    roadmapNote: "Community project boards are planned.",
  },

  // Media
  {
    id: "entertainment",
    title: "Entertainment",
    category: "media",
    icon: "Clapperboard",
    description: "Culture, events, and creator content",
    status: "COMING_SOON",
    destination: { kind: "none" },
    keywords: ["entertainment", "culture", "media"],
    roadmapNote: "Creator and entertainment surfaces are planned.",
  },
  {
    id: "creator-tools",
    title: "Creator tools",
    category: "media",
    icon: "Sparkles",
    description: "Publish and monetise content",
    status: "COMING_SOON",
    destination: { kind: "none" },
    keywords: ["creator", "publish"],
    roadmapNote: "Creator tooling is on the roadmap.",
  },
  {
    id: "digital-content",
    title: "Digital content",
    category: "media",
    icon: "Clapperboard",
    description: "Media library and experiences",
    status: "COMING_SOON",
    destination: { kind: "none" },
    keywords: ["content", "media", "video"],
    roadmapNote: "Digital content catalogue is planned.",
  },

  // AI
  {
    id: "openmind-ai",
    title: "OpenMind AI",
    category: "ai",
    icon: "Sparkles",
    description: "GreenHaven intelligence assistant",
    status: "COMING_SOON",
    destination: { kind: "none" },
    keywords: ["ai", "openmind", "assistant"],
    roadmapNote: "OpenMind AI will assist discovery and knowledge tasks.",
  },
  {
    id: "ai-search",
    title: "AI Search",
    category: "ai",
    icon: "Sparkles",
    description: "Smarter search across GreenHaven",
    status: "COMING_SOON",
    destination: { kind: "none" },
    keywords: ["search", "ai"],
    roadmapNote: "AI-assisted search is planned.",
  },
  {
    id: "knowledge",
    title: "Knowledge services",
    category: "ai",
    icon: "Sparkles",
    description: "Knowledge graphs and answers",
    status: "COMING_SOON",
    destination: { kind: "none" },
    keywords: ["knowledge", "answers"],
    roadmapNote: "Knowledge services are on the AI roadmap.",
  },
] as const

export function getServiceById(id: string): EcosystemService | undefined {
  return ECOSYSTEM_SERVICES.find((s) => s.id === id)
}

/** Featured strip: prefer interactive services marked featured */
export function getFeaturedServices(): EcosystemService[] {
  const featured = ECOSYSTEM_SERVICES.filter((s) => s.featured)
  const active = featured.filter((s) => s.status === "ACTIVE" || s.status === "BETA")
  // Keep roadmap featured items (Education, Transport, Hotels) after ACTIVE so strip stays rich
  const roadmap = featured.filter((s) => s.status === "COMING_SOON")
  return [...active, ...roadmap]
}

export function getServicesByCategory(category: ServiceCategoryId): EcosystemService[] {
  return ECOSYSTEM_SERVICES.filter((s) => s.category === category)
}

export function categoryLabel(id: ServiceCategoryId): string {
  return SERVICE_CATEGORIES.find((c) => c.id === id)?.label || id
}

/** Local-first search: title, description, keywords, category label */
export function searchServices(query: string): EcosystemService[] {
  const q = query.trim().toLowerCase()
  if (!q) return [...ECOSYSTEM_SERVICES]
  return ECOSYSTEM_SERVICES.filter((s) => {
    if (s.title.toLowerCase().includes(q)) return true
    if (s.description.toLowerCase().includes(q)) return true
    if (s.keywords.some((k) => k.includes(q) || q.includes(k))) return true
    if (categoryLabel(s.category).toLowerCase().includes(q)) return true
    if (s.status.toLowerCase().replace(/_/g, " ").includes(q)) return true
    return false
  })
}

export function isInteractiveStatus(status: ServiceStatus): boolean {
  return status === "ACTIVE" || status === "BETA"
}

/** Human-readable destination for reports */
export function formatServiceDestination(s: EcosystemService): string {
  const d = s.destination
  if (d.kind === "tab") return `tab:${d.tab}`
  if (d.kind === "overlay") return `overlay:${d.overlay}`
  if (d.kind === "focus") return `ecosystem:${d.serviceId}`
  return "none (coming soon)"
}
