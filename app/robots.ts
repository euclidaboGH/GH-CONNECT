import type { MetadataRoute } from "next"

/** Public robots policy — app shell is private; legal/support remain indexable. */
export default function robots(): MetadataRoute.Robots {
  const site = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "https://greenhaven.app"
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/privacy", "/terms", "/support", "/signin"],
        disallow: ["/api/", "/admin/", "/portal-setup"],
      },
    ],
    sitemap: `${site.replace(/\/$/, "")}/sitemap.xml`,
  }
}
