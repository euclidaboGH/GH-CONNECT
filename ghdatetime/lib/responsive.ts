// Responsive design utilities and hooks

export const breakpoints = {
  xs: 320,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
}

export const screens = {
  mobile: `(max-width: ${breakpoints.sm - 1}px)`,
  tablet: `(min-width: ${breakpoints.md}px)`,
  desktop: `(min-width: ${breakpoints.lg}px)`,
  widescreen: `(min-width: ${breakpoints.xl}px)`,
}

// Tailwind responsive classes generator
export function responsive(baseClass: string, mdClass: string, lgClass: string) {
  return `${baseClass} md:${mdClass} lg:${lgClass}`
}

// Safe area support for Pi Browser notches
export const safeAreaStyles = {
  container: "pt-safe-top pb-safe-bottom px-safe-left px-safe-right",
  top: "pt-safe-top",
  bottom: "pb-safe-bottom",
  left: "pl-safe-left",
  right: "pr-safe-right",
}

// Touch target minimum sizes
export const touchTargets = {
  small: "min-h-10 min-w-10", // 40px
  medium: "min-h-12 min-w-12", // 48px
  large: "min-h-14 min-w-14", // 56px
}

// Mobile-first breakpoints CSS
export const responsiveCss = `
  /* Mobile first (default) */
  .container { max-width: 100%; }
  
  /* Tablet */
  @media (min-width: 768px) {
    .container { max-width: 768px; }
  }
  
  /* Desktop */
  @media (min-width: 1024px) {
    .container { max-width: 1024px; }
  }
  
  /* Support for notched devices */
  @supports (padding: max(0px)) {
    body {
      padding-left: max(12px, env(safe-area-inset-left));
      padding-right: max(12px, env(safe-area-inset-right));
    }
  }
`

// Common responsive patterns
export const patterns = {
  // Two column on desktop, single on mobile
  twoColGrid: "grid grid-cols-1 md:grid-cols-2 gap-4",

  // Three column on desktop, two on tablet, one on mobile
  threeColGrid: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4",

  // Full width on mobile, contained on desktop
  container: "w-full md:max-w-2xl lg:max-w-4xl mx-auto",

  // Stack vertical on mobile, horizontal on desktop
  flexStack: "flex flex-col md:flex-row gap-4",

  // Hide on mobile, show on tablet+
  hideOnMobile: "hidden md:block",

  // Show on mobile, hide on tablet+
  showOnMobile: "md:hidden",

  // Responsive font sizes
  heroText: "text-2xl md:text-3xl lg:text-4xl",
  headingText: "text-xl md:text-2xl lg:text-3xl",
  bodyText: "text-base md:text-lg",
  smallText: "text-sm md:text-base",
}
