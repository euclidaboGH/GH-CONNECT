/**
 * Align app limits with the operator Supabase bucket (50 MB, private).
 * Folder prefixes (path policy): avatars | images | videos | audio | documents
 */
export const MEDIA_BUCKET_MAX_BYTES = 50 * 1024 * 1024
export const MEDIA_IMAGE_MAX_BYTES = 50 * 1024 * 1024
export const MEDIA_VIDEO_MAX_BYTES = 50 * 1024 * 1024
export const MEDIA_AUDIO_MAX_BYTES = 50 * 1024 * 1024
export const MEDIA_FILE_MAX_BYTES = 50 * 1024 * 1024
/** Vercel serverless body ceiling — larger files must use direct-to-storage. */
export const MEDIA_PROXY_MAX_BYTES = 4 * 1024 * 1024
export const MEDIA_CATEGORIES = ["avatars", "images", "videos", "audio", "documents"] as const
export type MediaCategory = (typeof MEDIA_CATEGORIES)[number]
