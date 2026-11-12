"use client"

/**
 * Save to collection — organizes locally; durable save is handled by feed savePost.
 * Creating a collection never invents server bookmarks.
 */

import { useEffect, useState } from "react"
import { Bookmark, Plus, X } from "lucide-react"
import {
  createCollection,
  loadCollections,
  savePostToCollection,
  type SavedCollection,
} from "@/lib/feed-profile-experience"

export function SaveToCollectionSheet({
  open,
  postId,
  onClose,
  onSaved,
}: {
  open: boolean
  postId: string | null
  onClose: () => void
  onSaved?: (collectionName: string) => void
}) {
  const [cols, setCols] = useState<SavedCollection[]>([])
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState("")

  useEffect(() => {
    if (open) {
      setCols(loadCollections())
      setCreating(false)
      setNewName("")
    }
  }, [open])

  if (!open || !postId) return null

  const pick = (c: SavedCollection) => {
    savePostToCollection(c.id, postId)
    onSaved?.(c.name)
    onClose()
  }

  const createAndSave = () => {
    const name = newName.trim()
    if (!name) return
    const col = createCollection(name)
    savePostToCollection(col.id, postId)
    setCols(loadCollections())
    onSaved?.(col.name)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[75] flex items-end bg-black/40 sm:items-center sm:justify-center" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-t-2xl bg-white p-4 shadow-2xl sm:rounded-2xl dark:bg-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Save to collection"
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-base font-bold text-foreground">
            <Bookmark size={18} className="text-purple-600" /> Save to collection
          </h3>
          <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-muted" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <p className="mb-2 text-[11px] text-muted-foreground">
          Collections organize saved posts on this device. The post is already saved to your account when the bookmark is on.
        </p>
        <ul className="max-h-56 space-y-1 overflow-y-auto">
          {cols.map((c) => (
            <button
              key={c.id}
              type="button"
              className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left hover:bg-purple-50 dark:hover:bg-purple-950/30"
              onClick={() => pick(c)}
            >
              <span className="text-sm font-semibold text-foreground">{c.name}</span>
              <span className="text-xs text-muted-foreground">{c.postIds.length}</span>
            </button>
          ))}
        </ul>
        {creating ? (
          <div className="mt-3 flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value.slice(0, 40))}
              placeholder="Collection name"
              className="min-h-10 flex-1 rounded-xl border border-border bg-background px-3 text-sm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") createAndSave()
              }}
            />
            <button
              type="button"
              onClick={createAndSave}
              disabled={!newName.trim()}
              className="rounded-xl bg-purple-600 px-3 text-sm font-bold text-white disabled:opacity-50"
            >
              Add
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-purple-300 px-3 py-2.5 text-sm font-semibold text-purple-700 dark:border-purple-800 dark:text-purple-300"
          >
            <Plus size={16} /> Create collection
          </button>
        )}
      </div>
    </div>
  )
}
