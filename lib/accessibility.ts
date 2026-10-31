// Accessibility utilities for WCAG compliance

export const a11y = {
  // Screen reader announcements
  announce: (message: string, politeness: "polite" | "assertive" = "polite"): void => {
    if (typeof document === "undefined") return

    const ariaLive = document.getElementById("aria-live-region")
    if (ariaLive) {
      ariaLive.setAttribute("aria-live", politeness)
      ariaLive.textContent = message
    }
  },

  // Create aria-label
  label: (element: string, label: string): string => {
    return `aria-label="${label}"`
  },

  // Focus trap for modals
  createFocusTrap: (container: HTMLElement): (() => void) => {
    const focusableElements = container.querySelectorAll(
      "button, [href], input, select, textarea, [tabindex]:not([tabindex=\"-1\"])"
    ) as NodeListOf<HTMLElement>

    if (focusableElements.length === 0) return () => {}

    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement.focus()
          e.preventDefault()
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement.focus()
          e.preventDefault()
        }
      }
    }

    container.addEventListener("keydown", handleKeyDown)
    firstElement.focus()

    return () => {
      container.removeEventListener("keydown", handleKeyDown)
    }
  },

  // Skip to main content
  addSkipLink: (): void => {
    if (typeof document === "undefined") return

    const skipLink = document.createElement("a")
    skipLink.href = "#main-content"
    skipLink.textContent = "Skip to main content"
    skipLink.className = "sr-only focus:not-sr-only"
    skipLink.style.cssText = `
      position: absolute;
      top: -40px;
      left: 0;
      background: #000;
      color: #fff;
      padding: 8px;
      z-index: 100;
    `
    skipLink.addEventListener("focus", () => {
      skipLink.style.top = "0"
    })
    skipLink.addEventListener("blur", () => {
      skipLink.style.top = "-40px"
    })

    document.body.prepend(skipLink)
  },

  // Check color contrast (WCAG AA standard: 4.5:1 for normal text)
  checkContrast: (color1: string, color2: string): number => {
    const rgb1 = hexToRgb(color1)
    const rgb2 = hexToRgb(color2)

    if (!rgb1 || !rgb2) return 0

    const lum1 = getLuminance(rgb1)
    const lum2 = getLuminance(rgb2)

    const lighter = Math.max(lum1, lum2)
    const darker = Math.min(lum1, lum2)

    return (lighter + 0.05) / (darker + 0.05)
  },

  // Add description to interactive elements
  describeElement: (element: string, description: string): string => {
    const id = `desc_${Math.random().toString(36).substr(2, 9)}`
    return `${element} aria-describedby="${id}" data-description="${description}"`
  },

  // Keyboard shortcut helper
  setupKeyboardShortcut: (key: string, callback: () => void): (() => void) => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === key && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        callback()
      }
    }

    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  },

  // Check if user prefers reduced motion
  prefersReducedMotion: (): boolean => {
    if (typeof window === "undefined") return false
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches
  },

  // Get system font preferences
  getPrefersColorScheme: (): "light" | "dark" => {
    if (typeof window === "undefined") return "light"
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
  },
}

// Helper functions
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null
}

function getLuminance(rgb: { r: number; g: number; b: number }): number {
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((v) => {
    v /= 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
