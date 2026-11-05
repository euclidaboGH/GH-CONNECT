"use client"

/**
 * Renders post text with tappable #hashtags → feed search.
 */

import { useCallback } from "react"

export function PostContentText({
  content,
  className = "",
}: {
  content: string
  className?: string
}) {
  const onHashtag = useCallback((tag: string) => {
    const clean = tag.replace(/^#/, "").trim()
    if (!clean) return
    try {
      window.dispatchEvent(
        new CustomEvent("ghc:feed-search", {
          detail: { query: `#${clean}` },
        }),
      )
      window.dispatchEvent(new CustomEvent("ghc:navigate-tab", { detail: "home" }))
    } catch {
      /* */
    }
  }, [])

  const text = String(content || "")
  if (!text) return null

  const parts = text.split(/(#[\w]{1,40})/g)
  return (
    <p className={className}>
      {parts.map((part, i) => {
        if (/^#[\w]{1,40}$/.test(part)) {
          return (
            <button
              key={i}
              type="button"
              className="font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
              onClick={(e) => {
                e.stopPropagation()
                onHashtag(part)
              }}
            >
              {part}
            </button>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </p>
  )
}
