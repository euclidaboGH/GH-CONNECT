// Core exports
export * from './ghc-types'
export * from './ghc-data'
export * from './validation'
export * from './design-system'
export * from './performance'
export * from './ux-constants'

// Utilities
export * from './search-utils'
export { screens, responsive, safeAreaStyles, touchTargets, responsiveCss, patterns } from './responsive'
// breakpoints live in design-system (string) and responsive (numeric px); not re-exported from barrel to avoid name clash
export * from './accessibility'
export * from './analytics'
export * from './notifications'
export * from './offline'
export * from './rate-limiter'

// Specialized
export { ErrorBoundary, PostErrorBoundary } from './error-boundary'
export { notificationSystem } from './notifications'
export { offlineSupport } from './offline'
export { messageLimiter, postLimiter, spamDetection } from './rate-limiter'

// Community Features
export * from './community-features'

export * from './permission-engine'
export * from './social-graph'

export * from './domains'

export * from './share-types'
export { ShareService } from './share-service'
