// Unified UX constants for consistency across the app

// Animation durations (ms)
export const ANIMATION_DURATIONS = {
  fast: 150,
  normal: 200,
  slow: 300,
  slower: 400,
  slowest: 500,
} as const

// Debounce delays (ms)
export const DEBOUNCE_DELAYS = {
  search: 300,
  input: 200,
  scroll: 100,
  resize: 150,
} as const

// Breakpoints (px)
export const BREAKPOINTS = {
  mobile: 0,
  tablet: 640,
  desktop: 1024,
  wide: 1280,
} as const

// Touch targets (minimum recommended: 44x44px)
export const TOUCH_TARGETS = {
  min: 44,
  recommended: 48,
  large: 56,
} as const

// Loading states
export const LOADING_STATES = {
  idle: 'idle',
  loading: 'loading',
  success: 'success',
  error: 'error',
} as const

// Common timeouts (ms)
export const TIMEOUTS = {
  shortToast: 2000,
  standardToast: 3000,
  longToast: 5000,
  networkRetry: 3000,
  debounceDelay: 300,
} as const

// Pagination
export const PAGINATION = {
  defaultPageSize: 20,
  maxResults: 100,
} as const

// API response codes
export const API_STATUS = {
  success: 200,
  created: 201,
  badRequest: 400,
  unauthorized: 401,
  forbidden: 403,
  notFound: 404,
  serverError: 500,
} as const
