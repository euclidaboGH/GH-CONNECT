"use client"

import { getShellMessage } from "@/lib/i18n/shell"

/** Keyboard-first bypass link to the active application content landmark. */
export function SkipToContent({ locale = "en-US" }: { locale?: string }) {
  return (
    <a
      href="#ghc-main-content"
      className="gh-skip-to-content"
    >
      {getShellMessage("skipToContent", locale)}
    </a>
  )
}
