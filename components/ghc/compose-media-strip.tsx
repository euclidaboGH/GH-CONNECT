"use client"

import { DurableImage } from "./durable-image"
/**
 * Phase 2 — professional media strip for UnifiedCompose.
 * Preview, remove, counts. Parent owns uploads and durable media URLs.
 */
import { useState } from "react"
import { X, Film, Expand } from "lucide-react"
import { MediaLightbox } from "./media-lightbox"
import { DurableVideo } from "./durable-video"

export function ComposeMediaStrip({
  images,
  video,
  maxImages,
  onRemoveImage,
  onClearImages,
  onRemoveVideo,
}: {
  images: string[]
  video?: string | null
  maxImages: number
  onRemoveImage: (index: number) => void
  onClearImages: () => void
  onRemoveVideo: () => void
}) {
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)
  if (!images.length && !video) return null

  return (
    <div className="mt-3 space-y-2" aria-label="Attached media">
      {images.length > 0 ? (
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold text-muted-foreground">
              {images.length}/{maxImages} photos
              {images.length >= maxImages ? " · limit reached" : ""}
            </p>
            {images.length > 1 ? (
              <button
                type="button"
                className="text-[11px] font-bold text-rose-700"
                onClick={onClearImages}
              >
                Clear all
              </button>
            ) : null}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {images.map((src, i) => (
              <div
                key={`${src.slice(0, 48)}-${i}`}
                className="group relative h-28 w-28 shrink-0 overflow-hidden rounded-xl border border-border/60 bg-muted [content-visibility:auto] [contain-intrinsic-size:112px_112px]"
              >
                <button
                  type="button"
                  className="absolute inset-0 z-0 block h-full w-full cursor-zoom-in focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-primary"
                  onClick={() => setPreviewIndex(i)}
                  aria-label={`Preview attached photo ${i + 1} of ${images.length}`}
                >
                                    <DurableImage
                    src={src}
                    alt={`Attached photo ${i + 1}`}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                  />
                  <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition-opacity group-hover:bg-black/15 group-hover:opacity-100 group-focus-within:opacity-100">
                    <Expand size={18} aria-hidden />
                  </span>
                </button>
                <span className="pointer-events-none absolute bottom-1 left-1 z-10 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {i + 1}
                </span>
                <button
                  type="button"
                  className="absolute right-1.5 top-1.5 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-black/75 text-white shadow transition hover:bg-black"
                  onClick={() => onRemoveImage(i)}
                  aria-label={`Remove photo ${i + 1}`}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {video ? (
        <div className="space-y-2 rounded-2xl border border-border/60 bg-muted/30 p-2.5">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-600/15 text-violet-700">
                <Film size={16} aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-foreground">Video attached</p>
                <p className="truncate text-[11px] text-muted-foreground">Preview before publishing</p>
              </div>
            </div>
            <button type="button" onClick={onRemoveVideo} className="min-h-9 shrink-0 rounded-lg px-2 text-[12px] font-bold text-rose-700 hover:bg-rose-50">
              Remove
            </button>
          </div>
          <DurableVideo src={video} controls playsInline muted={false} preload="metadata" className="max-h-56 w-full rounded-xl bg-black object-contain" />
        </div>
      ) : null}
      <MediaLightbox
        open={previewIndex !== null}
        urls={images.map((url) => ({ url, kind: "image" as const, alt: "Attached photo preview" }))}
        index={previewIndex ?? 0}
        caption={images.length > 1 ? `Photo ${(previewIndex ?? 0) + 1} of ${images.length}` : "Photo preview"}
        onClose={() => setPreviewIndex(null)}
      />
    </div>
  )
}

export function ComposeUploadProgress({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div className="mb-3 overflow-hidden rounded-xl border border-emerald-200/80 bg-emerald-50/90 px-3 py-2.5 dark:border-emerald-900 dark:bg-emerald-950/40" role="status" aria-live="polite">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-[12px] font-semibold text-emerald-900 dark:text-emerald-100">{message}</p>
        <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-700/80">Uploading</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-emerald-200/70 dark:bg-emerald-900">
        <div className="h-full w-2/3 animate-pulse rounded-full bg-emerald-600" />
      </div>
    </div>
  )
}

export function ComposeDraftBanner({
  visible,
  onDiscard,
}: {
  visible: boolean
  onDiscard: () => void
}) {
  if (!visible) return null
  return (
    <div className="mb-3 flex items-center justify-between gap-2 rounded-xl border border-amber-200/80 bg-amber-50/90 px-3 py-2 dark:border-amber-900 dark:bg-amber-950/40" role="status">
      <p className="text-[12px] font-semibold text-amber-950 dark:text-amber-100">
        Draft restored from this device
      </p>
      <button type="button" onClick={onDiscard} className="shrink-0 text-[11px] font-bold text-amber-900 underline-offset-2 hover:underline dark:text-amber-100">
        Discard
      </button>
    </div>
  )
}
