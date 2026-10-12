"use client"

import { useCallback, useEffect, useState } from "react"
import { PostComposer } from "./post-composer"
import type { ComposeMode } from "./unified-compose"

/**
 * Owns the single post/story composer for the entire signed-in app shell.
 * Keeping this above tab screens means Home, Profile, Discover, and other
 * surfaces can open the same composer even when the feed screen is not active.
 */
export function GlobalComposeHost() {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<ComposeMode>("post")

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen)
  }, [])

  useEffect(() => {
    const handleOpen = (event: Event) => {
      const detail = (event as CustomEvent<{ mode?: ComposeMode }>).detail
      setMode(detail?.mode === "story" ? "story" : "post")
      setOpen(true)
    }
    const handleClose = () => setOpen(false)
    window.addEventListener("ghc:open-compose", handleOpen)
    window.addEventListener("ghc:close-compose", handleClose)
    window.addEventListener("ghc:tab-change", handleClose)
    window.addEventListener("ghc:close-transient-ui", handleClose)
    return () => {
      window.removeEventListener("ghc:open-compose", handleOpen)
      window.removeEventListener("ghc:close-compose", handleClose)
      window.removeEventListener("ghc:tab-change", handleClose)
      window.removeEventListener("ghc:close-transient-ui", handleClose)
    }
  }, [])

  return <PostComposer open={open} onOpenChange={handleOpenChange} initialMode={mode} />
}
