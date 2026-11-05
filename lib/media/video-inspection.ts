export type VideoInspection = {
  durationMs: number
  width: number
  height: number
  aspectRatio: number
}

export const MAX_PULSE_DURATION_MS = 180_000
export const MAX_PULSE_DIMENSION = 3840

export async function inspectVideoFile(file: File | Blob, timeoutMs = 12_000): Promise<VideoInspection> {
  if (typeof document === "undefined") throw new Error("VIDEO_INSPECTION_UNAVAILABLE")
  if (!file.type.startsWith("video/")) throw new Error("INVALID_VIDEO_TYPE")
  const url = URL.createObjectURL(file)
  const video = document.createElement("video")
  video.preload = "metadata"
  video.muted = true
  video.playsInline = true
  try {
    const result = await new Promise<VideoInspection>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error("VIDEO_METADATA_TIMEOUT")), timeoutMs)
      const finish = (fn: () => void) => { window.clearTimeout(timer); fn() }
      video.onloadedmetadata = () => {
        const durationMs = Math.round(Math.max(0, video.duration) * 1000)
        const width = Math.max(0, video.videoWidth)
        const height = Math.max(0, video.videoHeight)
        if (!Number.isFinite(video.duration) || durationMs <= 0 || !width || !height) return finish(() => reject(new Error("VIDEO_METADATA_INVALID")))
        finish(() => resolve({ durationMs, width, height, aspectRatio: width / height }))
      }
      video.onerror = () => finish(() => reject(new Error("VIDEO_DECODE_FAILED")))
      video.src = url
    })
    return result
  } finally {
    video.removeAttribute("src")
    video.load()
    URL.revokeObjectURL(url)
  }
}

export async function validatePulseVideo(file: File | Blob): Promise<VideoInspection> {
  if (file.size <= 0 || file.size > 40 * 1024 * 1024) throw new Error("PULSE_FILE_TOO_LARGE")
  const info = await inspectVideoFile(file)
  if (info.durationMs > MAX_PULSE_DURATION_MS) throw new Error("PULSE_VIDEO_TOO_LONG")
  if (info.width > MAX_PULSE_DIMENSION || info.height > MAX_PULSE_DIMENSION) throw new Error("PULSE_VIDEO_DIMENSIONS_TOO_LARGE")
  return info
}
