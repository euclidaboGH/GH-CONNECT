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
        {eyebrow ? <p className="gh-section-eyebrow mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-primary">{eyebrow}</p> : null}
        <h2 className="gh-section-title text-[15px] font-bold leading-tight tracking-[-0.02em] text-foreground sm:text-base">{title}</h2>
        {description ? <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground sm:text-[13px]">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}
