/**
 * GreenHaven design system — single source for spacing, radius, type, buttons.
 * CSS variables in app/globals.css are the runtime source of truth.
 * Use these helpers in TS / className composition.
 */

export const space = {
  1: "var(--gh-space-1)", // 4px
  2: "var(--gh-space-2)", // 8px
  3: "var(--gh-space-3)", // 12px
  4: "var(--gh-space-4)", // 16px
  5: "var(--gh-space-5)", // 24px (legacy product scale)
  6: "var(--gh-space-6)", // 32px
  7: "var(--gh-space-7)", // 40px
  8: "var(--gh-space-8)", // 48px
} as const

export const radius = {
  sm: "var(--gh-radius-sm)", // 12px
  md: "var(--gh-radius-md)", // 16px
  lg: "var(--gh-radius-lg)", // 20px
  full: "9999px",
} as const

/** Layout insets */
export const layout = {
  appShellMax: "var(--gh-shell-max)",
  pageGutter: "var(--gh-page-gutter)",
  contentMax: "var(--gh-shell-content-max)",
  bottomNavHeight: "var(--gh-bottom-nav-height)",
  /** nav + safe-area + 16px — every scroll root */
  bottomContentInset: "var(--gh-bottom-content-inset)",
  screenBottomInset: "var(--gh-screen-bottom-inset)",
  contentMax: "var(--gh-content-max)",
} as const

export const typeClass = {
  display: "gh-type-display",
  title: "gh-type-title",
  body: "gh-type-body",
  meta: "gh-type-meta",
  section: "gh-section-title",
} as const

export const surfaceClass = {
  card: "gh-card",
  cardOutline: "gh-card-outline",
  surface: "gh-surface",
  muted: "gh-surface-muted",
  elevated: "gh-surface-elevated",
} as const

export const buttonClass = {
  base: "gh-btn",
  primary: "gh-btn gh-btn-primary",
  secondary: "gh-btn gh-btn-secondary",
  destructive: "gh-btn gh-btn-destructive",
  icon: "gh-icon-btn",
} as const

export const scrollClass = {
  root: "gh-scroll-root gh-scroll-stable",
  padBottom: "gh-content-pad-bottom",
  screenPad: "gh-screen-pad-bottom",
} as const

/** Tailwind-friendly class snippets for common patterns */
export const ds = {
  pageHeaderSlim: "gh-page-header-slim",
  scrollRoot: "gh-scroll-root gh-scroll-stable",
  contentPad: "pb-[var(--gh-bottom-content-inset)]",
  btnPrimary: "gh-btn gh-btn-primary",
  btnSecondary: "gh-btn gh-btn-secondary",
  btnDestructive: "gh-btn gh-btn-destructive",
  card: "gh-card",
  cardOutline: "gh-card-outline",
} as const

// Legacy exports (kept for existing imports)
// Semantic CSS variables already contain complete color values (hex or OKLCH).
// Wrapping them in hsl() produces invalid CSS and silently breaks consumers.
export const colors = {
  primary: "var(--primary)",
  background: "var(--background)",
  foreground: "var(--foreground)",
  muted: "var(--muted)",
  border: "var(--border)",
  destructive: "var(--destructive)",
}

export const spacing = {
  1: "var(--gh-space-1)",
  2: "var(--gh-space-2)",
  3: "var(--gh-space-3)",
  4: "var(--gh-space-4)",
  5: "var(--gh-space-5)",
  6: "var(--gh-space-6)",
  7: "var(--gh-space-7)",
  8: "var(--gh-space-8)",
}

export const borderRadius = {
  sm: "var(--gh-radius-sm)",
  md: "var(--gh-radius-md)",
  lg: "var(--gh-radius-lg)",
  full: "9999px",
}

export const shadows = {
  sm: "0 1px 2px rgb(0 0 0 / 0.04)",
  md: "0 4px 16px rgb(0 0 0 / 0.06)",
}

export const typography = {
  display: { fontSize: "var(--gh-type-display)", lineHeight: "var(--gh-leading-display)", fontWeight: "800" },
  title: { fontSize: "var(--gh-type-title)", lineHeight: "var(--gh-leading-title)", fontWeight: "700" },
  body: { fontSize: "var(--gh-type-body)", lineHeight: "var(--gh-leading-body)", fontWeight: "400" },
  meta: { fontSize: "var(--gh-type-meta)", lineHeight: "var(--gh-leading-meta)", fontWeight: "500" },
}

export const zIndex = {
  hide: -1,
  auto: "auto",
  base: 0,
  dropdown: 10,
  sticky: 20,
  fixed: 30,
  backdrop: 40,
  offcanvas: 50,
  modal: 60,
  popover: 70,
  tooltip: 80,
}

export const breakpoints = {
  sm: "640px",
  md: "768px",
  lg: "1024px",
  xl: "1280px",
  "2xl": "1536px",
}

export const components = {
  button: { minHeight: "var(--gh-control-height)", minWidth: "var(--gh-control-height)" },
  card: { borderRadius: "var(--gh-radius-md)", padding: "var(--gh-card-padding)" },
  modal: { maxWidth: "var(--gh-dialog-max-width)", borderRadius: "var(--gh-radius-lg)" },
}

export const piBrowser = {
  safeAreaTop: "env(safe-area-inset-top)",
  safeAreaBottom: "env(safe-area-inset-bottom)",
  safeAreaLeft: "env(safe-area-inset-left)",
  safeAreaRight: "env(safe-area-inset-right)",
}


/** Semantic state classes shared by forms, transactions and social surfaces. */
export const statusClass = {
  success: "gh-status gh-status-success",
  warning: "gh-status gh-status-warning",
  danger: "gh-status gh-status-danger",
  info: "gh-status gh-status-info",
} as const

/** Layout and feedback primitives for consistent responsive screens. */
export const feedbackClass = {
  empty: "gh-empty-state",
  skeleton: "gh-skeleton",
  pageGutter: "gh-page-gutter",
  contentWidth: "gh-content-width",
} as const

export const motion = {
  fast: "var(--gh-motion-fast)",
  normal: "var(--gh-motion-normal)",
  slow: "var(--gh-motion-slow)",
  standardEasing: "var(--gh-ease-standard)",
} as const


/** Stable public asset paths. Keep these mapped to the owner-approved files in /public. */
export const brandAssets = {
  /** Owner-approved GreenHaven artwork, cropped into transparent responsive variants. Dark variants lift only the wordmark for contrast. */
  greenHavenLogo: "/greenhaven-logo.png",
  greenHavenLogoDark: "/greenhaven-logo-dark.png",
  greenHavenLockup: "/greenhaven-lockup.png",
  greenHavenLockupDark: "/greenhaven-lockup-dark.png",
  greenHavenMark: "/greenhaven-mark.png",
  greenHavenMarkDark: "/greenhaven-mark-dark.png",
  ghcCoinLogo: "/ghc-coin-logo.png",
  ghcCoinLarge: "/ghc-coin-logo.png",
  ghcCoinMedium: "/ghc-coin-64.png",
  ghcCoinSmall: "/ghc-coin-32.png",
} as const

/** Interaction and layout contracts used by shared components. */
export const accessibility = {
  minimumTouchTargetPx: 44,
  focusVisibleClass: "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
  reducedMotionMediaQuery: "(prefers-reduced-motion: reduce)",
} as const
