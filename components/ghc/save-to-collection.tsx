"use client"

import { useEffect, useState } from "react"
import { Bookmark, X } from "lucide-react"
import {
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

  useEffect(() => {
    if (open) setCols(loadCollections())
  }, [open])

  if (!open || !postId) return null

  return (
    <div className="fixed inset-0 z-[75] flex items-end bg-black/40 sm:items-center sm:justify-center" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-t-2xl bg-white p-4 shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Save to collection"
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-base font-bold text-gray-900">
            <Bookmark size={18} className="text-purple-600" /> Save to collection
          </h3>
          <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-gray-100" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <ul className="space-y-1">
          {cols.map((c) => (
            <button
              key={c.id}
              type="button"
              className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left hover:bg-purple-50"
              onClick={() => {
                savePostToCollection(c.id, postId)
                onSaved?.(c.name)
                onClose()
              }}
            >
              <span className="text-sm font-semibold text-gray-900">{c.name}</span>
              <span className="text-xs text-gray-400">{c.postIds.length}</span>
            </button>
          ))}
        </ul>
      </div>
    </div>
  )
}
