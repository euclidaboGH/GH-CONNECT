// Unified premium design system constants

// Elevated color palette - sophisticated and modern
export const colors = {
  // Primary — GreenHaven green/teal identity
  primary: "#059669", // Emerald-600
  primaryLight: "#34d399",
  primaryDark: "#047857",
  
  // Secondary — deep teal
  secondary: "#0d9488", // Teal-600
  secondaryLight: "#2dd4bf",
  secondaryDark: "#0f766e",
  
  // Accent (purple kept secondary for legacy accents)
  accent: "#7c3aed",
  success: "#10b981",
  destructive: "#ef4444",
  warning: "#f59e0b",
  info: "#0ea5e9"
  
  // Neutral palette - premium grays
  neutral: {
    50: "#fafaf9",
    100: "#f5f5f4",
    200: "#e7e5e4",
    300: "#d6d3d1",
    400: "#a8a29e",
    500: "#78716b",
    600: "#57534e",
    700: "#3f3935",
    800: "#292520",
    900: "#1c1917",
  },

  // Enhanced semi-transparent overlays
  overlay: {
    dark: "rgba(0, 0, 0, 0.4)",
    light: "rgba(255, 255, 255, 0.1)",
  },
}

// Premium typography scale
export const typography = {
  hero: { size: "3xl md:4xl lg:5xl", weight: "700", lineHeight: "1.1", letter: "-0.02em" },
  h1: { size: "2xl md:3xl", weight: "700", lineHeight: "1.2", letter: "-0.01em" },
  h2: { size: "xl md:2xl", weight: "700", lineHeight: "1.3", letter: "-0.005em" },
  h3: { size: "lg md:xl", weight: "600", lineHeight: "1.4" },
  body: { size: "base", weight: "400", lineHeight: "1.6", letter: "0.01em" },
  bodySmall: { size: "sm", weight: "400", lineHeight: "1.6", letter: "0.02em" },
  label: { size: "sm", weight: "600", lineHeight: "1.5", letter: "0.05em", transform: "uppercase" },
  small: { size: "xs", weight: "500", lineHeight: "1.5" },
  tiny: { size: "xs", weight: "400", lineHeight: "1.4" },
}

// Premium spacing scale
export const spacing = {
  xs: "0.5rem", // 8px
  sm: "0.75rem", // 12px
  md: "1rem", // 16px
  lg: "1.5rem", // 24px
  xl: "2rem", // 32px
  "2xl": "2.5rem", // 40px
  "3xl": "3rem", // 48px
  "4xl": "4rem", // 64px
}

// Premium border radius
export const radius = {
  none: "0",
  xs: "0.25rem", // 4px
  sm: "0.375rem", // 6px
  md: "0.5rem", // 8px
  lg: "0.75rem", // 12px
  xl: "1rem", // 16px
  "2xl": "1.25rem", // 20px
  full: "9999px",
}

// Premium shadow elevation system
export const shadows = {
  none: "none",
  xs: "0 1px 2px 0 rgba(0, 0, 0, 0.04)",
  sm: "0 1px 3px 0 rgba(0, 0, 0, 0.08), 0 1px 2px 0 rgba(0, 0, 0, 0.04)",
  md: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
  lg: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
  xl: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
  "2xl": "0 25px 50px -12px rgba(0, 0, 0, 0.15)",
  // Elevation shadows for premium cards
  elevated: "0 0px 1px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.05), 0 4px 6px rgba(0, 0, 0, 0.07), 0 10px 13px rgba(0, 0, 0, 0.08), 0 20px 20px rgba(0, 0, 0, 0.06)",
  // Hover shadow for interactive elements
  hover: "0 8px 16px rgba(0, 0, 0, 0.12)",
  // Floating/lifted shadow
  floating: "0 20px 40px -12px rgba(0, 0, 0, 0.2)",
  // Subtle inset shadow
  inset: "inset 0 2px 4px rgba(0, 0, 0, 0.06)",
}

// Premium animation timing
export const animation = {
  // Easing curves
  easing: {
    // Smooth, natural motion
    smooth: "cubic-bezier(0.4, 0, 0.2, 1)",
    // Spring-like motion
    bounce: "cubic-bezier(0.34, 1.56, 0.64, 1)",
    // Quick deceleration
    ease: "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
    // Material design
    standard: "cubic-bezier(0.4, 0, 0.6, 1)",
    // Emphasis curves
    emphasize: "cubic-bezier(0.3, 0, 0.8, 0.15)",
  },
  // Durations
  fast: "150ms",
  normal: "200ms",
  slow: "300ms",
  slower: "400ms",
  slowest: "500ms",
}

// Z-index scale
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

// Breakpoints for responsive design
export const breakpoints = {
  sm: "640px",
  md: "768px",
  lg: "1024px",
  xl: "1280px",
  "2xl": "1536px",
}

// Transitions
export const transitions = {
  all: "all 200ms ease-in-out",
  colors: "background-color 200ms ease-in-out, color 200ms ease-in-out",
  opacity: "opacity 200ms ease-in-out",
  transform: "transform 200ms ease-in-out",
}

// Component-specific constants
export const components = {
  button: {
    minHeight: "44px", // Touch target
    minWidth: "44px",
    padding: "0.75rem 1.5rem",
    fontSize: "0.875rem",
    fontWeight: "600",
  },
  input: {
    minHeight: "40px",
    padding: "0.5rem 1rem",
    fontSize: "1rem",
    borderWidth: "1px",
  },
  card: {
    borderRadius: "12px",
    padding: "1rem",
    shadow: "md",
  },
  modal: {
    maxWidth: "448px",
    borderRadius: "16px",
  },
}

// Pi Browser optimizations
export const piBrowser = {
  // Safe area support for notches
  safeAreaTop: "env(safe-area-inset-top)",
  safeAreaBottom: "env(safe-area-inset-bottom)",
  safeAreaLeft: "env(safe-area-inset-left)",
  safeAreaRight: "env(safe-area-inset-right)",

  // Performance optimizations
  preferGpu: "transform, opacity",
  reduceMotion: "prefers-reduced-motion",
}
