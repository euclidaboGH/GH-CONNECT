// Accessibility utilities for WCAG compliance

let announcementTimer: ReturnType<typeof setTimeout> | undefined

function getLiveRegion(): HTMLElement | null {
  if (typeof document === "undefined") return null
  const existing = document.getElementById("aria-live-region")
  if (existing) return existing

  if (!document.body) return null
  const region = document.createElement("div")
  region.id = "aria-live-region"
  region.className = "sr-only"
  region.setAttribute("aria-live", "polite")
  region.setAttribute("aria-atomic", "true")
  document.body.appendChild(region)
  return region
}

export const a11y = {
  // Screen reader announcements. Clear first so repeated messages are announced
  // reliably; bound the text to avoid accidentally announcing untrusted payloads.
  announce: (message: string, politeness: "polite" | "assertive" = "polite"): void => {
    const ariaLive = getLiveRegion()
    if (!ariaLive) return
    const safeMessage = typeof message === "string" ? message.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ").trim().slice(0, 240) : ""
    if (!safeMessage) return

    if (announcementTimer) clearTimeout(announcementTimer)
    ariaLive.setAttribute("aria-live", politeness)
    ariaLive.textContent = ""
    announcementTimer = setTimeout(() => {
      ariaLive.textContent = safeMessage
      announcementTimer = undefined
    }, 40)
  },

  // Create aria-label
  label: (element: string, label: string): string => {
    return `aria-label="${label}"`
  },

  // Keyboard focus management for modal surfaces. Re-query on every Tab press so
  // disabled/hidden controls and conditionally rendered actions cannot trap focus.
  createFocusTrap: (
    container: HTMLElement,
    options: { onEscape?: () => void; restoreFocus?: boolean } = {},
  ): (() => void) => {
    if (typeof document === "undefined" || !container) return () => {}

    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    const selector = [
      "a[href]", "area[href]", "button:not([disabled])", "input:not([disabled]):not([type=\"hidden\"])",
      "select:not([disabled])", "textarea:not([disabled])", "summary", "iframe[title]",
      "[contenteditable=\"true\"]", "[tabindex]:not([tabindex=\"-1\"])"
    ].join(",")

    const getFocusable = (): HTMLElement[] => Array.from(container.querySelectorAll<HTMLElement>(selector)).filter((element) => {
      if (element.tabIndex < 0 || element.hasAttribute("disabled") || element.getAttribute("aria-disabled") === "true" || element.getAttribute("aria-hidden") === "true") return false
      if (element.closest('[hidden], [inert], [aria-hidden="true"]')) return false
      const style = typeof window !== "undefined" ? window.getComputedStyle(element) : null
      if (style && (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse")) return false
      return element.getClientRects().length > 0
    })

    const focusWithoutScroll = (element: HTMLElement) => {
      try { element.focus({ preventScroll: true }) } catch { element.focus() }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && options.onEscape) {
        event.preventDefault()
        options.onEscape()
        return
      }
      if (event.key !== "Tab") return
      const focusable = getFocusable()
      if (focusable.length === 0) {
        event.preventDefault()
        if (!container.hasAttribute("tabindex")) container.setAttribute("tabindex", "-1")
        focusWithoutScroll(container)
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      if (event.shiftKey && (active === first || active === container || !container.contains(active))) {
        event.preventDefault()
        focusWithoutScroll(last)
      } else if (!event.shiftKey && (active === last || active === container || !container.contains(active))) {
        event.preventDefault()
        focusWithoutScroll(first)
      }
    }

    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target
      if (target instanceof Node && !container.contains(target)) {
        const focusable = getFocusable()
        focusWithoutScroll(focusable[0] ?? container)
      }
    }

    container.addEventListener("keydown", handleKeyDown)
    document.addEventListener("focusin", handleFocusIn, true)
    const initial = container.querySelector<HTMLElement>("[autofocus]")
    const focusable = getFocusable()
    if (initial && focusable.includes(initial) && !initial.hasAttribute("disabled")) focusWithoutScroll(initial)
    else if (focusable.length > 0) focusWithoutScroll(focusable[0])
    else {
      if (!container.hasAttribute("tabindex")) container.setAttribute("tabindex", "-1")
      focusWithoutScroll(container)
    }

    let released = false
    return () => {
      if (released) return
      released = true
      container.removeEventListener("keydown", handleKeyDown)
      document.removeEventListener("focusin", handleFocusIn, true)
      if (options.restoreFocus !== false && previouslyFocused?.isConnected && !container.contains(previouslyFocused)) {
        focusWithoutScroll(previouslyFocused)
      }
    }
  },

  // Skip to main content
  addSkipLink: (): void => {
    if (typeof document === "undefined") return

    // The authenticated shell already renders its own skip link. Avoid adding
    // a duplicate, and only create a link when its destination actually exists.
    if (document.querySelector('a[href="#ghc-main-content"], #global-skip-to-content')) return
    const target = document.getElementById("ghc-main-content") ?? document.getElementById("main-content")
    if (!target) return

    const skipLink = document.createElement("a")
    skipLink.id = "global-skip-to-content"
    skipLink.href = `#${target.id}`
    skipLink.textContent = "Skip to main content"
    skipLink.className = "sr-only focus:not-sr-only focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
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


  // Enforce a practical mobile touch target without dictating visual design.
  touchTargetClass: (minimum = 44): string => {
    const px = Math.max(44, Math.round(minimum))
    return px <= 44 ? "min-h-11 min-w-11" : "min-h-12 min-w-12"
  },

  // Restore focus after closing a modal/sheet.
  captureFocus: (): (() => void) => {
    if (typeof document === "undefined") return () => {}
    const active = document.activeElement as HTMLElement | null
    return () => {
      try { active?.focus?.() } catch { /* focus target may have been removed */ }
    }
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
