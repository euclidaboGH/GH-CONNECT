"use client"

import { useEffect, useState } from "react"
import { CreatorStudioPanel } from "./creator-studio-panel"

export function CreatorStudioOverlay() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onOpen = () => setOpen(true)
    window.addEventListener("ghc:open-creator-studio", onOpen)
    return () => window.removeEventListener("ghc:open-creator-studio", onOpen)
  }, [])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-background shadow-2xl sm:rounded-2xl">
        <CreatorStudioPanel onClose={() => setOpen(false)} />
      </div>
    </div>
  )
}
