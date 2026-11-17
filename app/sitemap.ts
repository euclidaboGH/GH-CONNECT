import type { MetadataRoute } from "next"

/** Public sitemap for legal and entry surfaces only (not authenticated app routes). */
export default function sitemap(): MetadataRoute.Sitemap {
  const site = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "https://greenhaven.app").replace(/\/$/, "")
  const lastModified = new Date()
  return [
    { url: `${site}/`, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${site}/signin`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: `${site}/privacy`, lastModified, changeFrequency: "yearly", priority: 0.5 },
    { url: `${site}/terms`, lastModified, changeFrequency: "yearly", priority: 0.5 },
    { url: `${site}/support`, lastModified, changeFrequency: "monthly", priority: 0.6 },
  ]
}
