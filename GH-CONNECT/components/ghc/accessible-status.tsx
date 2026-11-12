import type { ReactNode } from "react"

type AccessibleStatusProps = {
  children: ReactNode
  label?: string
  className?: string
  busy?: boolean
  politeness?: "polite" | "assertive" | "off"
  atomic?: boolean
}

/** Consistent live feedback primitive for loading, success and recoverable errors. */
export function AccessibleStatus({
  children,
  label,
  className,
  busy = false,
  politeness = "polite",
  atomic = true,
}: AccessibleStatusProps) {
  return (
    <div
      className={className}
      role={politeness === "assertive" ? "alert" : "status"}
      aria-live={politeness}
      aria-atomic={atomic}
      aria-busy={busy}
      aria-label={label}
    >
      {children}
    </div>
  )
}
