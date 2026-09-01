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
  5: "var(--gh-space-5)", // 24px
} as const

export const radius = {
  sm: "var(--gh-radius-sm)", // 12px
  md: "var(--gh-radius-md)", // 16px
  lg: "var(--gh-radius-lg)", // 20px
  full: "9999px",
} as const

/** Layout insets */
export const layout = {
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
export const colors = {
  primary: "hsl(var(--primary))",
  background: "hsl(var(--background))",
  foreground: "hsl(var(--foreground))",
  muted: "hsl(var(--muted))",
  border: "hsl(var(--border))",
  destructive: "hsl(var(--destructive))",
}

export const spacing = {
  1: "0.25rem",
  2: "0.5rem",
  3: "0.75rem",
  4: "1rem",
  5: "1.5rem",
  6: "2rem",
  8: "2rem",
}

export const borderRadius = {
  sm: "0.75rem",
  md: "1rem",
  lg: "1.25rem",
  full: "9999px",
}

export const shadows = {
  sm: "0 1px 2px rgb(0 0 0 / 0.04)",
  md: "0 4px 16px rgb(0 0 0 / 0.06)",
}

export const typography = {
  display: { fontSize: "1.25rem", fontWeight: "800" },
  title: { fontSize: "1rem", fontWeight: "700" },
  body: { fontSize: "0.875rem", fontWeight: "400" },
  meta: { fontSize: "0.6875rem", fontWeight: "500" },
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
  button: { minHeight: "44px", minWidth: "44px" },
  card: { borderRadius: "16px", padding: "1rem" },
  modal: { maxWidth: "448px", borderRadius: "16px" },
}

export const piBrowser = {
  safeAreaTop: "env(safe-area-inset-top)",
  safeAreaBottom: "env(safe-area-inset-bottom)",
  safeAreaLeft: "env(safe-area-inset-left)",
  safeAreaRight: "env(safe-area-inset-right)",
}
