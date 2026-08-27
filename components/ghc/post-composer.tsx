"use client"

import { UnifiedCompose, type ComposeMode } from "./unified-compose"

interface PostComposerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialMode?: ComposeMode
}

export function PostComposer({ open, onOpenChange, initialMode = "post" }: PostComposerProps) {
  return <UnifiedCompose open={open} onOpenChange={onOpenChange} initialMode={initialMode} />
}
