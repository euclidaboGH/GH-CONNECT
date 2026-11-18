/**
 * Alias for /api/media/health — some operators probe /api/health/media
 */
export { GET } from "@/app/api/media/health/route"
export const runtime = "nodejs"
export const dynamic = "force-dynamic"
