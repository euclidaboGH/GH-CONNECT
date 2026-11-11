"use client"

import { extractHttpUrls, isProbablyExternalUrl } from "@/lib/product/essentials"

/**
 * Renders plain text with http(s) URLs as external links (new tab, noopener).
 * Does not execute scripts or invent content.
 */
export function SafeTextWithLinks({
  text,
  className = "",
}: {
  text: string
  className?: string
}) {
  const body = String(text || "")
  const urls = extractHttpUrls(body)
  if (!urls.length) {
    return <span className={className}>{body}</span>
  }
  const parts: Array<{ type: "text" | "url"; value: string }> = []
  let rest = body
  for (const url of urls) {
    const idx = rest.indexOf(url)
    if (idx < 0) continue
    if (idx > 0) parts.push({ type: "text", value: rest.slice(0, idx) })
    parts.push({ type: "url", value: url })
    rest = rest.slice(idx + url.length)
  }
  if (rest) parts.push({ type: "text", value: rest })

  return (
    <span className={className}>
      {parts.map((p, i) =>
        p.type === "url" && isProbablyExternalUrl(p.value) ? (
          <a
            key={`${p.value}-${i}`}
            href={p.value}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="font-medium text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-400"
          >
            {p.value}
          </a>
        ) : (
          <span key={`t-${i}`}>{p.value}</span>
        )
      )}
    </span>
  )
}
