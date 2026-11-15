import type { EcosystemService, ServiceCategoryId } from "@/lib/navigation/service-registry"

/**
 * Shared thirty-track upgrade contract for every GreenHaven ecosystem service.
 * These are implementation objectives and release gates, not claims that a feature is shipped.
 * Service status and launch authorization remain owned by service-registry.
 */
export type ServiceUpgradeTrack = {
  id: string
  title: string
  objective: string
  launchGate: string
}

const CATEGORY_CONTEXT: Record<ServiceCategoryId, string> = {
  social: "profiles, relationships, conversations, community safety, and consent",
  commerce: "catalogue quality, seller/buyer workflows, orders, fulfilment, and disputes",
  education: "learning pathways, learner progress, educator tools, and verified credentials",
  transport: "journey planning, operator verification, dispatch, safety, and shipment tracking",
  hospitality: "property/operator verification, availability, booking lifecycle, and guest support",
  finance: "authoritative balances, payment evidence, ledger integrity, entitlements, and reconciliation",
  charity: "cause verification, donor transparency, restricted funds, impact evidence, and accountability",
  media: "creator identity, publishing rights, content safety, media delivery, and audience controls",
  ai: "source-grounded answers, user consent, data boundaries, evaluation, and human oversight",
}

/** Per-service scope keeps each module's ten tracks grounded in its own job. */
const SERVICE_CONTEXT: Readonly<Record<string, string>> = {
  "community": "community spaces, membership, boards, moderation, chapters, and participation",
  "gh-chat": "private and group conversations, delivery state, attachments, presence, and abuse prevention",
  "connections": "follow and friend graph, requests, consent, blocks, mutes, and relationship integrity",
  "matches": "mutual interest signals, explainable relevance, consent, safe introductions, and match privacy",
  "events": "verified organizers, event discovery, time zones, venue safety, capacity, and future RSVP integrity",
  "marketplace": "product discovery, verified listings, seller identity, orders, fulfilment, and dispute evidence",
  "seller-centre": "seller onboarding, catalogue ownership, inventory, order operations, and seller analytics",
  "orders": "buyer and seller order views, payment evidence, fulfilment milestones, and dispute resolution",
  "services-ip": "professional service profiles, provider verification, scope definition, delivery, and reviews",
  "intellectual-marketplace": "digital ownership, licensing terms, rights verification, secure delivery, and infringement handling",
  "education": "learning programme governance, educator verification, learner pathways, and credentials",
  "primary-edu": "age-appropriate foundational learning, guardian consent, safeguarding, and progress reporting",
  "secondary-edu": "curriculum pathways, learner assessment, educator tools, safeguarding, and progress portability",
  "tertiary-edu": "advanced programmes, institution verification, academic records, and credential validation",
  "scholars-hub": "scholar identity, research collaboration, publication provenance, and academic community safety",
  "courses": "course authoring, enrolment eligibility, learning progress, assessments, and certificate integrity",
  "transport": "verified transport operators, trip discovery, passenger safety, dispatch, and incident handling",
  "road": "road operator verification, route safety, vehicle details, trip status, and incident response",
  "rail": "rail operator and station data, timetable provenance, seat availability, and journey disruption handling",
  "air": "airline and route provenance, schedule changes, booking references, and passenger support",
  "sea": "maritime operator verification, vessel and route data, cargo status, and port handoffs",
  "logistics": "shipment identity, carrier verification, custody events, delivery proof, and exception resolution",
  "hotels": "property verification, room inventory, rate transparency, guest safety, and stay support",
  "accommodation": "host and property identity, listing accuracy, availability, guest policies, and issue resolution",
  "reservations": "availability holds, booking lifecycle, cancellation rules, payment evidence, and concurrency safety",
  "travel": "verified travel providers, itinerary composition, schedule changes, traveller support, and refunds evidence",
  "wallet": "canonical PI and GHC balances, ledger history, withdrawal authorization, and reconciliation",
  "ghc": "GHC issuance rules, supply visibility, verified transfers, utility, and ledger integrity",
  "pi-payments": "Pi SDK authentication, payment intent lifecycle, server verification, receipts, and idempotent settlement",
  "rewards": "eligibility, one-time claims, verified earning evidence, reward ledger, and abuse controls",
  "membership": "tier entitlements, access enforcement, renewal concurrency, expiry, and payment reconciliation",
  "charity": "verified charitable organizations, governance, restricted funds, donor consent, and impact accountability",
  "causes": "cause verification, eligibility criteria, evidence standards, and transparent progress updates",
  "donations": "donor authorization, payment confirmation, restricted-fund accounting, receipts, and refunds",
  "community-projects": "project ownership, budgets, milestone evidence, community oversight, and outcome reporting",
  "entertainment": "licensed media discovery, age-appropriate controls, creator provenance, and playback reliability",
  "creator-tools": "creator identity, draft publishing, rights management, audience controls, and content analytics",
  "digital-content": "digital asset provenance, licensing, secure delivery, access expiry, and content moderation",
  "openmind-ai": "consented assistant workflows, source-grounded output, data minimization, and human oversight",
  "ai-search": "permission-aware retrieval, source citations, ranking transparency, and private-data exclusion",
  "knowledge": "knowledge provenance, version history, review workflows, citation quality, and access boundaries",
}

const TRACKS: ReadonlyArray<Omit<ServiceUpgradeTrack, "objective"> & { objective: (context: string) => string }> = [
  {
    id: "journeys",
    title: "End-to-end service journeys",
    objective: (c) => `Map and validate the complete ${c} journey, including empty, error, and recovery states.`,
    launchGate: "Critical user journeys have acceptance tests and no dead-end actions.",
  },
  {
    id: "experience",
    title: "Premium responsive experience",
    objective: (c) => `Deliver a consistent mobile-first interface for ${c}, with clear hierarchy and predictable navigation.`,
    launchGate: "Phone, tablet, and desktop layouts pass visual and interaction review.",
  },
  {
    id: "accessibility",
    title: "Accessibility and localization",
    objective: (c) => `Support keyboard, screen-reader, contrast, text scaling, and localized presentation across ${c}.`,
    launchGate: "Accessibility checks and supported locale/RTL tests pass.",
  },
  {
    id: "identity",
    title: "Identity, roles, and permissions",
    objective: (c) => `Define authenticated ownership, role boundaries, consent, and least-privilege access for ${c}.`,
    launchGate: "Server-side authorization tests deny cross-account and unauthorized access.",
  },
  {
    id: "data-contracts",
    title: "Canonical data contracts",
    objective: (c) => `Specify durable records, lifecycle states, validation, and source-of-truth rules for ${c}.`,
    launchGate: "Contracts are versioned and integration-tested against the canonical backend.",
  },
  {
    id: "security-privacy",
    title: "Security and privacy hardening",
    objective: (c) => `Apply input bounds, abuse controls, privacy defaults, retention rules, and auditability to ${c}.`,
    launchGate: "Threat review, RLS/API authorization checks, and abuse tests pass.",
  },
  {
    id: "integrity",
    title: "Transaction and state integrity",
    objective: (c) => `Define idempotency, concurrency, reconciliation, and evidence requirements wherever ${c} changes durable state.`,
    launchGate: "No client-authoritative balances, rewards, payments, bookings, or entitlements; retries are safe.",
  },
  {
    id: "reliability",
    title: "Reliability and recovery",
    objective: (c) => `Design bounded timeouts, retry rules, partial-failure recovery, and graceful degradation for ${c}.`,
    launchGate: "Failure-injection and retry/recovery tests pass without duplicate side effects.",
  },
  {
    id: "observability",
    title: "Operational visibility",
    objective: (c) => `Add privacy-safe diagnostics, actionable metrics, audit events, and support workflows for ${c}.`,
    launchGate: "Operators can diagnose failures without exposing secrets or private user content.",
  },
  {
    id: "release-readiness",
    title: "Integration and launch readiness",
    objective: (c) => `Validate dependencies, migration order, feature flags, rollback, and production readiness for ${c}.`,
    launchGate: "Clean-environment rehearsal, release review, and explicit launch authorization are complete.",
  },
  // Additional twenty-track layer requested for every registered ecosystem service.
  // These are scoped implementation objectives, not claims of completed features.
  {
    id: "onboarding",
    title: "Guided onboarding",
    objective: (c) => `Design a consent-aware first-use path that explains eligibility, setup, and safe next steps for ${c}.`,
    launchGate: "New and returning users can complete or safely skip onboarding without losing existing data.",
  },
  {
    id: "discovery-search",
    title: "Discovery and search quality",
    objective: (c) => `Define relevant search, filtering, empty-state, and ranking behavior for ${c} without exposing restricted records.`,
    launchGate: "Search respects visibility and authorization rules and returns stable, explainable results.",
  },
  {
    id: "personalization",
    title: "User-controlled personalization",
    objective: (c) => `Add explicit preference controls for ${c} while keeping personalization optional and reversible.`,
    launchGate: "Users can inspect, change, and reset preferences; defaults do not infer sensitive traits.",
  },
  {
    id: "notifications",
    title: "Notification preferences and delivery",
    objective: (c) => `Specify event-driven notifications for ${c}, including consent, deduplication, quiet hours, and delivery failure handling.`,
    launchGate: "Notifications are authorized, deduplicated, preference-aware, and never the sole proof of a transaction.",
  },
  {
    id: "collaboration",
    title: "Collaboration and sharing",
    objective: (c) => `Define safe collaboration and sharing boundaries for ${c}, including revocation and private-by-default access.`,
    launchGate: "Shared access is explicit, least-privilege, revocable, and covered by cross-account tests.",
  },
  {
    id: "content-lifecycle",
    title: "Content and record lifecycle",
    objective: (c) => `Specify create, update, archive, deletion, and recovery lifecycle rules for records associated with ${c}.`,
    launchGate: "Lifecycle transitions are validated server-side and preserve required audit evidence.",
  },
  {
    id: "moderation-trust",
    title: "Trust, safety, and moderation",
    objective: (c) => `Add reporting, review, enforcement, appeals, and abuse-prevention requirements relevant to ${c}.`,
    launchGate: "Moderation actions are permission-checked, auditable, appealable where appropriate, and tested for abuse.",
  },
  {
    id: "data-portability",
    title: "Data portability and user controls",
    objective: (c) => `Define user access, export, correction, and deletion workflows for eligible ${c} data.`,
    launchGate: "Exports are authenticated and bounded; deletion follows retention and legal-hold requirements.",
  },
  {
    id: "api-contracts",
    title: "API and integration contracts",
    objective: (c) => `Version external and internal integration contracts for ${c} with strict schemas and compatibility rules.`,
    launchGate: "Contracts reject unknown unsafe input and have compatibility tests for supported versions.",
  },
  {
    id: "performance-budget",
    title: "Performance budgets",
    objective: (c) => `Set measurable load, rendering, query, and payload budgets for the primary ${c} journeys.`,
    launchGate: "Representative mobile and server-side performance tests meet agreed budgets under load.",
  },
  {
    id: "offline-resilience",
    title: "Network resilience and offline states",
    objective: (c) => `Define safe degraded and reconnect behavior for ${c} without treating stale client state as authoritative.`,
    launchGate: "Reconnect and retry tests do not duplicate writes or present stale data as confirmed.",
  },
  {
    id: "support-escalation",
    title: "Support and escalation paths",
    objective: (c) => `Provide contextual help, case routing, and escalation evidence for user issues involving ${c}.`,
    launchGate: "Support views expose only minimum necessary information and record privileged access.",
  },
  {
    id: "audit-history",
    title: "User-visible activity history",
    objective: (c) => `Define a privacy-safe history of meaningful ${c} actions with clear pending, completed, and failed states.`,
    launchGate: "History is sourced from canonical records and distinguishes pending outcomes from confirmed outcomes.",
  },
  {
    id: "quality-assurance",
    title: "Automated quality assurance",
    objective: (c) => `Build unit, contract, integration, accessibility, and regression coverage around ${c}.`,
    launchGate: "Critical paths have deterministic tests and regressions block release.",
  },
  {
    id: "feature-controls",
    title: "Feature flags and staged rollout",
    objective: (c) => `Define server-enforced rollout controls for ${c} with cohort targeting, kill switches, and audit trails.`,
    launchGate: "Disabled flags fail closed and cannot be overridden by client input.",
  },
  {
    id: "data-retention",
    title: "Data retention and minimization",
    objective: (c) => `Minimize collected data and define retention, archival, and purge schedules for ${c}.`,
    launchGate: "Retention jobs are observable, retry-safe, and aligned with documented policy.",
  },
  {
    id: "fraud-abuse",
    title: "Fraud and abuse resistance",
    objective: (c) => `Threat-model automation, spam, account abuse, replay, and collusion risks specific to ${c}.`,
    launchGate: "Rate limits and abuse controls are enforced server-side and tested under adversarial input.",
  },
  {
    id: "localization-qa",
    title: "Localization and regional readiness",
    objective: (c) => `Prepare ${c} for locale-aware dates, numbers, currencies, time zones, language expansion, and RTL layouts where relevant.`,
    launchGate: "Locale-sensitive values are formatted correctly and never alter canonical stored amounts or timestamps.",
  },
  {
    id: "backup-recovery",
    title: "Backup and disaster recovery",
    objective: (c) => `Document recoverability, backup dependencies, restore objectives, and evidence retention for ${c}.`,
    launchGate: "A restore rehearsal proves recovery without replaying irreversible side effects.",
  },
  {
    id: "operator-console",
    title: "Operator workflows and governance",
    objective: (c) => `Define least-privilege operator workflows for review, correction, escalation, and lifecycle administration of ${c}.`,
    launchGate: "Privileged actions require authorization, reason capture, audit evidence, and safe rollback where possible.",
  },
]

export function getServiceUpgradePlan(service: EcosystemService): ServiceUpgradeTrack[] {
  const context = SERVICE_CONTEXT[service.id] || CATEGORY_CONTEXT[service.category]
  return TRACKS.map((track) => ({
    id: track.id,
    title: track.title,
    objective: track.objective(context),
    launchGate: track.launchGate,
  }))
}

export function hasCompleteUpgradeCoverage(services: readonly EcosystemService[]): boolean {
  return services.every((service) => {
    const plan = getServiceUpgradePlan(service)
    return plan.length === 30 && new Set(plan.map((track) => track.id)).size === 30
  })
}
