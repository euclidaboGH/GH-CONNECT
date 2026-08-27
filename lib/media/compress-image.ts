/**
 * Professional image compression for GH Connect.
 * Accepts any reasonable image size/type; outputs a compact data URL
 * sized for the intended use (avatar, feed, theme, etc.).
 */

export type ImagePurpose =
  | "avatar"
  | "cover"
  | "feed"
  | "story"
  | "message"
  | "theme"
  | "general"

export interface CompressOptions {
  purpose?: ImagePurpose
  /** Override max edge (px) */
  maxWidth?: number
  maxHeight?: number
  /** 0–1 JPEG quality */
  quality?: number
  /** Prefer webp when browser supports it */
  preferWebp?: boolean
  /** Reject files larger than this (bytes). Default 25MB */
  maxInputBytes?: number
}

const PRESETS: Record<
  ImagePurpose,
  { maxWidth: number; maxHeight: number; quality: number }
> = {
  avatar: { maxWidth: 512, maxHeight: 512, quality: 0.84 },
  cover: { maxWidth: 1600, maxHeight: 900, quality: 0.82 },
  feed: { maxWidth: 1280, maxHeight: 1280, quality: 0.82 },
  story: { maxWidth: 1080, maxHeight: 1920, quality: 0.8 },
  message: { maxWidth: 1280, maxHeight: 1280, quality: 0.78 },
  theme: { maxWidth: 1440, maxHeight: 2560, quality: 0.72 },
  general: { maxWidth: 1200, maxHeight: 1200, quality: 0.8 },
}

const DEFAULT_MAX_INPUT = 25 * 1024 * 1024

function supportsWebp(): boolean {
  try {
    const c = document.createElement("canvas")
    return c.toDataURL("image/webp").startsWith("data:image/webp")
  } catch {
    return false
  }
}

function scaleDimensions(
  width: number,
  height: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  if (width <= 0 || height <= 0) return { width: 1, height: 1 }
  const ratio = Math.min(maxWidth / width, maxHeight / height, 1)
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  }
}

/**
 * Compress any image File/Blob to a professional size for the given purpose.
 * Never upscales. Uses high-quality downscale via canvas.
 */
export function compressImageFile(
  file: File | Blob,
  options: CompressOptions = {}
): Promise<string> {
  const purpose = options.purpose || "general"
  const preset = PRESETS[purpose]
  const maxWidth = options.maxWidth ?? preset.maxWidth
  const maxHeight = options.maxHeight ?? preset.maxHeight
  const quality = options.quality ?? preset.quality
  const maxInput = options.maxInputBytes ?? DEFAULT_MAX_INPUT
  const preferWebp = options.preferWebp !== false

  if (file.size > maxInput) {
    return Promise.reject(
      new Error(
        `Image is too large (${Math.round(file.size / (1024 * 1024))}MB). Maximum is ${Math.round(maxInput / (1024 * 1024))}MB.`
      )
    )
  }

  const type = (file as File).type || ""
  if (type && !type.startsWith("image/") && type !== "application/octet-stream") {
    return Promise.reject(new Error("Please choose an image file."))
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error("Could not read image file."))
    reader.onload = () => {
      const img = new Image()
      img.crossOrigin = "anonymous"
      img.onload = () => {
        try {
          const { width, height } = scaleDimensions(
            img.naturalWidth || img.width,
            img.naturalHeight || img.height,
            maxWidth,
            maxHeight
          )
          const canvas = document.createElement("canvas")
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext("2d")
          if (!ctx) {
            reject(new Error("Canvas not available"))
            return
          }
          ctx.imageSmoothingEnabled = true
          ctx.imageSmoothingQuality = "high"
          // White fill so transparent PNGs don't become black in JPEG
          ctx.fillStyle = "#ffffff"
          ctx.fillRect(0, 0, width, height)
          ctx.drawImage(img, 0, 0, width, height)

          const useWebp = preferWebp && supportsWebp()
          const mime = useWebp ? "image/webp" : "image/jpeg"
          const dataUrl = canvas.toDataURL(mime, quality)

          // If still huge, second pass at lower quality
          const approxBytes = Math.ceil((dataUrl.length * 3) / 4)
          if (approxBytes > 900_000 && quality > 0.55) {
            const tighter = canvas.toDataURL(mime, Math.max(0.55, quality - 0.15))
            resolve(tighter)
            return
          }
          resolve(dataUrl)
        } catch {
          reject(new Error("Image conversion failed"))
        }
      }
      img.onerror = () =>
        reject(new Error("Could not decode this image. Try JPG, PNG, or WebP."))
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}

/** Backward-compatible default: general purpose ~1200px */
export function compressImage(file: File): Promise<string> {
  return compressImageFile(file, { purpose: "general" })
}

export function compressForAvatar(file: File | Blob) {
  return compressImageFile(file, { purpose: "avatar" })
}
export function compressForCover(file: File | Blob) {
  return compressImageFile(file, { purpose: "cover" })
}
export function compressForFeed(file: File | Blob) {
  return compressImageFile(file, { purpose: "feed" })
}
export function compressForTheme(file: File | Blob) {
  return compressImageFile(file, { purpose: "theme" })
}
export function compressForMessage(file: File | Blob) {
  return compressImageFile(file, { purpose: "message" })
}
