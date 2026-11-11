"use client"

/**
 * Canonical compose entry for Feed.
 * Thin wrapper over UnifiedCompose — do not add a third composer.
 * Profile, Create hub, and Home all fire `ghc:open-compose`.
 */
import { UnifiedCompose, type ComposeMode } from "./unified-compose"

interface PostComposerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialMode?: ComposeMode
}

export function PostComposer({ open, onOpenChange, initialMode = "post" }: PostComposerProps) {
  return <UnifiedCompose open={open} onOpenChange={onOpenChange} initialMode={initialMode} />
}
