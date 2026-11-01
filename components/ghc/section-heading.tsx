import type { ReactNode } from "react"

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  className = "",
}: {
  eyebrow?: string
  title: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={`gh-section-heading flex min-w-0 items-end justify-between gap-3 ${className}`}>
      <div className="min-w-0">
        {eyebrow ? <p className="gh-section-eyebrow">{eyebrow}</p> : null}
        <h2 className="gh-section-title">{title}</h2>
        {description ? <p className="gh-section-description">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}
